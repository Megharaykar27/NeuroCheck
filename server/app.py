"""
NeuroCheck API (Flask)

GET    /api/health
GET    /api/model                 model metrics for the "How it works" page
POST   /api/predict               risk assessment (saved to history if logged in and save=true)
POST   /api/auth/register         create account
POST   /api/auth/login            log in, returns a token
GET    /api/auth/me               current user
GET    /api/history               my saved assessments
DELETE /api/history/<id>          delete one saved assessment
"""
import json
import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

from predictor import ValidationError, predictor

load_dotenv()

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///neurocheck.db")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY") or os.urandom(32).hex()
if not os.getenv("SECRET_KEY"):
    print("WARNING: SECRET_KEY not set in .env, so logins reset when the server restarts.")
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

CORS(app, origins=os.getenv("CLIENT_URL", "http://localhost:5173").split(","))
limiter = Limiter(get_remote_address, app=app, default_limits=[], storage_uri="memory://")
db = SQLAlchemy(app)


# ------------------------------------------------------------------- models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)  # never the plain password
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def public(self):
        return {"id": self.id, "name": self.name, "email": self.email}


class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    inputs = db.Column(db.Text, nullable=False)  # JSON
    risk = db.Column(db.Float, nullable=False)
    level = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def public(self):
        return {"id": self.id, "inputs": json.loads(self.inputs), "risk": self.risk, "level": self.level,
                "created_at": self.created_at.replace(tzinfo=timezone.utc).isoformat()}


with app.app_context():
    db.create_all()


# --------------------------------------------------------------------- auth
def make_token(user):
    payload = {"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


def current_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        data = jwt.decode(header[7:], app.config["SECRET_KEY"], algorithms=["HS256"])
        return db.session.get(User, int(data["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        g.user = current_user()
        if not g.user:
            return jsonify(message="Please log in first."), 401
        return fn(*args, **kwargs)
    return wrapper


def body():
    return request.get_json(silent=True) or {}


# ------------------------------------------------------------------- routes
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/model")
def model_info():
    return jsonify(predictor.metrics)


@app.post("/api/predict")
@limiter.limit("60 per minute")
def predict():
    data = body()
    try:
        result = predictor.predict(data)
    except ValidationError as e:
        return jsonify(message=str(e)), 400

    user = current_user()
    if user and data.get("save"):
        a = Assessment(user_id=user.id, inputs=json.dumps(result["inputs"]), risk=result["risk"], level=result["level"])
        db.session.add(a)
        db.session.commit()
        result["saved_id"] = a.id
    return jsonify(result)


@app.post("/api/auth/register")
@limiter.limit("10 per 15 minutes")
def register():
    data = body()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not name or "@" not in email:
        return jsonify(message="Please enter your name and a valid email."), 400
    if len(password) < 6:
        return jsonify(message="Password must be at least 6 characters."), 400
    if User.query.filter_by(email=email).first():
        return jsonify(message="This email is already registered."), 400
    user = User(name=name[:80], email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    return jsonify(token=make_token(user), user=user.public()), 201


@app.post("/api/auth/login")
@limiter.limit("20 per 15 minutes")
def login():
    data = body()
    user = User.query.filter_by(email=(data.get("email") or "").strip().lower()).first()
    if not user or not check_password_hash(user.password_hash, data.get("password") or ""):
        return jsonify(message="Invalid email or password."), 400
    return jsonify(token=make_token(user), user=user.public())


@app.get("/api/auth/me")
@login_required
def me():
    return jsonify(g.user.public())


@app.get("/api/history")
@login_required
def history():
    items = Assessment.query.filter_by(user_id=g.user.id).order_by(Assessment.created_at.desc()).limit(100).all()
    return jsonify([a.public() for a in items])


@app.delete("/api/history/<int:item_id>")
@login_required
def delete_history(item_id):
    a = Assessment.query.filter_by(id=item_id, user_id=g.user.id).first()
    if not a:
        return jsonify(message="Not found."), 404
    db.session.delete(a)
    db.session.commit()
    return jsonify(message="Deleted.")


@app.errorhandler(404)
def not_found(_):
    return jsonify(message="Route not found."), 404


@app.errorhandler(429)
def too_many(_):
    return jsonify(message="Too many requests. Please wait a minute and try again."), 429


@app.errorhandler(500)
def server_error(_):
    return jsonify(message="Server error. Please try again."), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", 5001)), debug=os.getenv("FLASK_DEBUG") == "1")
