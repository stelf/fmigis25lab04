from flask import Flask, jsonify, send_from_directory, request
from psycopg_pool import ConnectionPool
import json
import os
import requests # Import the requests library
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))  # Load environment variables from .env file

app = Flask(__name__)

geoapify_api_key = os.getenv('GEOAPIFY_API_KEY')
if not geoapify_api_key:
    print("Error: GEOAPIFY_API_KEY environment variable not set.")
    exit(1)

# Вземи порта от променлива на средата или използвай 8686 по подразбиране
try:
    port = int(os.getenv('PYTHON_PORT', os.getenv('SERVPORT', 8686)))
except ValueError:
    print("Warning: Invalid PYTHON_PORT or SERVPORT environment variable. Using default port 8686.")
    port = 8686

# Път до публичната директория
public_dir = os.path.join(
    os.path.dirname( os.path.abspath(__file__ )), 
    '..', 
    'public')

# PostgreSQL конфигурация за връзка. чете се от .env 
db_config = {
    'user': os.getenv('PGUSER'),
    'host': os.getenv('PGHOST'),
    'dbname': os.getenv('PGDATABASE'),
    'password': os.getenv('PGPASSWORD'),
    'port': int(os.getenv('PGPORT', 5432)), # Default to 5432 if not set
    'client_encoding': os.getenv('PGCLIENTENCODING', 'UTF8')  # Default to UTF8
}

required_db_keys = ['user', 'host', 'dbname', 'password', 'port']
if not all(db_config.get(key) for key in required_db_keys):
    print("Error: Missing one or more required database configuration environment variables.")
    print(f"PGUSER: {db_config.get('user')}")
    print(f"PGHOST: {db_config.get('host')}")
    print(f"PGDATABASE: {db_config.get('dbname')}")
    print(f"PGPASSWORD: {'******' if db_config.get('password') else None}") # Avoid printing password
    print(f"PGPORT: {db_config.get('port')}")
    exit(1)
    
# Създаваме connection pool (сбор от вече вързани към базата обекти←)
pg_pool = ConnectionPool(conninfo="user={user} host={host} dbname={dbname} password={password} port={port} client_encoding={client_encoding}".format(**db_config))

# кирилицата да не се цитира в JSON отговорите
app.config['JSON_AS_ASCII'] = False

# Ако не ти е ясно какво прави тази функция, проблем, коуега
def init_conn():
    try:
        with pg_pool.connection() as conn:
            print('Connected to the database')
            with conn.cursor() as cur:
                cur.execute("SHOW client_encoding")
                ce_row = cur.fetchone()
                client_encoding = ce_row[0] if ce_row else None
                cur.execute("SHOW server_encoding")
                se_row = cur.fetchone()
                server_encoding = se_row[0] if se_row else None
                print(f"Client encoding: {client_encoding}, Server encoding: {server_encoding}")
        return True
    except Exception as err:
        print('Error connecting to the database', err)
        exit(1)

# Крайна точка за получаване на пространствени данни като GeoJSON
@app.route('/api/jp_gari', methods=['GET'])
def get_gari():
    try:
        with pg_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT ST_AsGeoJSON(ST_Transform(geom, 4326)) as geojson, tradename FROM public.jp_gari')
                rows = cur.fetchall()

        geojson_data = {
            'type': 'FeatureCollection',
            'features': [
                {
                    'type': 'Feature',
                    'geometry': 
                        json.loads(row[0]),
                    'properties': {
                        'tradename': row[1] if row[1] else 'Unknown'
                    },
                } for row in rows
            ],
        }

        return jsonify(geojson_data)
    except Exception as err:
        print(err)
        return f"<html><body><p>Error fetching data from database.</p><pre><code>{err}</code></pre></body></html>", 500

@app.route('/api/isoline', methods=['GET'])
def get_isoline():
    try:
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        mode = request.args.get('mode')
        ranges = request.args.get('range') # comma-separated string

        if not all([lat, lon, mode, ranges]):
            return jsonify({"error": "Missing required parameters (lat, lon, mode, range)"}), 400

        params = {
            "lat": lat,
            "lon": lon,
            "type": "time",
            "mode": mode,
            "range": ranges,
            "apiKey": geoapify_api_key
        }
        
        response = requests.get("https://api.geoapify.com/v1/isoline", params=params)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        print(f"Error calling Geoapify API: {e}")
        return jsonify({"error": f"Failed to fetch isoline data: {e}"}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

@app.route('/')
def index():     # index.html се подава винаги на основния URL адрес
    return send_from_directory(public_dir, 'index.html')

# Обслужва подавнето на статични файлове от публичната директория
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(public_dir, filename)

if __name__ == '__main__':
    conn = init_conn()       # Проверяваме връзката с базата данни преди стартиране на сървъра
    app.run(port=port)
