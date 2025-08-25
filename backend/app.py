import os
import sqlite3
from flask import Flask, jsonify, request
from flask_cors import CORS

DB_PATH = os.environ.get("DB_PATH", "/data/score.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


app = Flask(__name__)
CORS(app)

# Ensure database and seed row exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS score (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)")
conn.commit()
cur.execute("INSERT OR IGNORE INTO score (id, value) VALUES (1, 0)")
conn.commit()
conn.close()


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/score", methods=["GET"])
def get_score():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT value FROM score WHERE id=1")
    row = cur.fetchone()
    conn.close()
    value = row[0] if row else 0
    return jsonify({"score": value})


@app.route("/api/score", methods=["POST"])
def post_score():
    data = request.get_json(silent=True) or {}
    increment = data.get("increment")
    set_score = data.get("score")

    conn = get_db()
    cur = conn.cursor()

    if isinstance(increment, int):
        cur.execute("UPDATE score SET value = value + ? WHERE id=1", (increment,))
    elif isinstance(set_score, int):
        cur.execute("UPDATE score SET value = ? WHERE id=1", (set_score,))
    else:
        conn.close()
        return jsonify({"error": "must provide 'increment' or 'score' as integer"}), 400

    conn.commit()
    cur.execute("SELECT value FROM score WHERE id=1")
    value = cur.fetchone()[0]
    conn.close()
    return jsonify({"score": value})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001)
