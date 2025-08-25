import os
import sqlite3
import time
import threading
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from datetime import datetime, timezone

DB_PATH = os.environ.get("DB_PATH", "/data/score.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev_secret_key")
# Enable CORS with credentials support for cookies/sessions
CORS(app, supports_credentials=True, origins=["*"], allow_headers=["Content-Type", "Authorization", "X-Requested-With"])

# Ensure database and seed tables exist
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# User table
cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

# Points table (stores both points and action points)
cur.execute("""
CREATE TABLE IF NOT EXISTS user_points (
    user_id INTEGER PRIMARY KEY,
    points INTEGER DEFAULT 0,
    action_points INTEGER DEFAULT 0,
    last_point_time TIMESTAMP,
    last_ap_conversion TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
""")

# Create default user if none exist
cur.execute("INSERT OR IGNORE INTO users (id, username) VALUES (1, 'default')")
cur.execute("INSERT OR IGNORE INTO user_points (user_id, points, action_points) VALUES (1, 0, 0)")
conn.commit()
conn.close()

# Background thread to convert points to action points every minute
def convert_points_to_ap():
    while True:
        try:
            conn = get_db()
            cur = conn.cursor()
            
            # Get all users who haven't had a conversion in the last minute
            now = datetime.now(timezone.utc).isoformat()
            # Convert all points to AP at a 1:1 ratio every minute
            cur.execute("""
                UPDATE user_points 
                SET action_points = action_points + points, 
                    points = 0,
                    last_ap_conversion = ? 
                WHERE julianday(?) - julianday(last_ap_conversion) >= 0.00069444 OR last_ap_conversion IS NULL
            """, (now, now))
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error in AP conversion thread: {e}")
        
        time.sleep(60)  # Run every 60 seconds

# Start the background thread
ap_thread = threading.Thread(target=convert_points_to_ap, daemon=True)
ap_thread.start()


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/users", methods=["GET"])
def get_users():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users ORDER BY username")
    users = [{"id": row[0], "username": row[1]} for row in cur.fetchall()]
    conn.close()
    return jsonify({"users": users})


@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    
    if not username or len(username) < 2:
        return jsonify({"error": "username must be at least 2 characters"}), 400
        
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("INSERT INTO users (username) VALUES (?)", (username,))
        user_id = cur.lastrowid
        cur.execute("INSERT INTO user_points (user_id) VALUES (?)", (user_id,))
        conn.commit()
        conn.close()
        return jsonify({"id": user_id, "username": username})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "username already exists"}), 400


@app.route("/api/session", methods=["POST"])
def set_user():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    # Convert to int if string was passed
    if isinstance(user_id, str) and user_id.isdigit():
        user_id = int(user_id)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()
    
    if not user:
        # User not found, try to find any user
        cur.execute("SELECT id, username FROM users LIMIT 1")
        user = cur.fetchone()
        if not user:
            # Create default user if none exists
            cur.execute("INSERT OR IGNORE INTO users (id, username) VALUES (1, 'default')")
            cur.execute("INSERT OR IGNORE INTO user_points (user_id) VALUES (1)")
            conn.commit()
            user = (1, 'default')
    
    session["user_id"] = user[0]  # Use the actual user ID
    conn.close()
    
    # Debug print to console
    print(f"Set user session to user_id: {user[0]}, username: {user[1]}")
    
    return jsonify({"id": user[0], "username": user[1]})


@app.route("/api/session", methods=["GET"])
def get_user():
    user_id = session.get("user_id", 1)  # Default to user 1
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()
    
    if not user:
        conn.close()
        return jsonify({"error": "user not found"}), 404
    
    conn.close()
    return jsonify({"id": user[0], "username": user[1]})


@app.route("/api/points", methods=["GET"])
def get_points():
    user_id = session.get("user_id", 1)  # Default to user 1
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT points, action_points 
        FROM user_points 
        WHERE user_id = ?
    """, (user_id,))
    row = cur.fetchone()
    conn.close()
    
    if not row:
        return jsonify({"points": 0, "action_points": 0})
    
    return jsonify({"points": row[0], "action_points": row[1]})


@app.route("/api/points", methods=["POST"])
def update_points():
    user_id = session.get("user_id", 1)  # Default to user 1
    data = request.get_json(silent=True) or {}
    increment = data.get("increment", 0)
    
    if not isinstance(increment, int):
        return jsonify({"error": "increment must be an integer"}), 400
    
    conn = get_db()
    cur = conn.cursor()
    
    # Update points and last_point_time
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("""
        UPDATE user_points 
        SET points = points + ?, 
            last_point_time = ? 
        WHERE user_id = ?
    """, (increment, now, user_id))
    
    # Retrieve updated points
    cur.execute("SELECT points, action_points FROM user_points WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    
    conn.commit()
    conn.close()
    
    if not row:
        return jsonify({"error": "user not found"}), 404
        
    return jsonify({"points": row[0], "action_points": row[1]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001)
