import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.utils import secure_filename
from models import db, User, Issue, IssueImage, StatusLog
from geopy.distance import geodesic
from config import Config
from datetime import datetime, timedelta
import uuid

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
jwt = JWTManager(app)
db.init_app(app)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# Helper functions
def is_within_radius(user_lat, user_lon, issue_lat, issue_lon, radius_km):
    return geodesic((user_lat, user_lon), (issue_lat, issue_lon)).km <= radius_km

def format_issue(issue, current_user_id=None):
    return {
        "id": issue.id,
        "title": issue.title,
        "description": issue.description,
        "category": issue.category,
        "latitude": issue.latitude,
        "longitude": issue.longitude,
        "status": issue.status,
        "created_at": issue.created_at.isoformat(),
        "user": {
            "id": issue.user.id,
            "username": issue.user.username,
            "is_anonymous": issue.is_anonymous
        } if not issue.is_anonymous else None,
        "upvotes": issue.upvotes,
        "flags": issue.flags,
        "images": [img.filename for img in issue.images],
        "can_edit": current_user_id == issue.user_id if current_user_id else False,
        "logs": [{
            "status": log.status,
            "timestamp": log.timestamp.isoformat(),
            "admin": {
                "id": log.admin.id,
                "username": log.admin.username
            } if log.admin else None
        } for log in issue.logs]
    }

# Auth Routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username already exists"}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email already exists"}), 400
    
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        "message": "User registered successfully",
        "token": user.generate_token()
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({"error": "Invalid username or password"}), 401
    
    return jsonify({
        "message": "Logged in successfully",
        "token": user.generate_token(),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin
        }
    })

# Issue Routes
@app.route('/api/issues', methods=['GET'])
@jwt_required(optional=True)
def get_issues():
    try:
        user_lat = float(request.args.get('lat'))
        user_lon = float(request.args.get('lon'))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid coordinates"}), 400
    
    radius = float(request.args.get('radius', 5))
    category = request.args.get('category')
    status = request.args.get('status')
    
    current_user_id = get_jwt_identity()
    
    query = Issue.query
    if category:
        query = query.filter_by(category=category)
    if status:
        query = query.filter_by(status=status)
    
    issues = query.all()
    nearby_issues = [
        issue for issue in issues 
        if is_within_radius(user_lat, user_lon, issue.latitude, issue.longitude, radius)
    ]
    
    return jsonify([format_issue(issue, current_user_id) for issue in nearby_issues])

@app.route('/api/issues', methods=['POST'])
@jwt_required()
def report_issue():
    user_id = get_jwt_identity()
    data = request.form
    
    try:
        new_issue = Issue(
            title=data['title'],
            description=data['description'],
            category=data['category'],
            latitude=float(data['latitude']),
            longitude=float(data['longitude']),
            user_id=user_id,
            is_anonymous=data.get('is_anonymous', 'false').lower() == 'true'
        )
        db.session.add(new_issue)
        db.session.commit()
        
        # Handle file uploads
        if 'images' in request.files:
            for file in request.files.getlist('images'):
                if file and allowed_file(file.filename):
                    filename = f"{uuid.uuid4()}.{secure_filename(file.filename).rsplit('.', 1)[1].lower()}"
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                    db.session.add(IssueImage(filename=filename, issue_id=new_issue.id))
        
        # Log initial status
        log = StatusLog(issue_id=new_issue.id, status="Reported")
        db.session.add(log)
        db.session.commit()
        
        return jsonify(format_issue(new_issue, user_id)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route('/api/issues/<int:issue_id>', methods=['PUT'])
@jwt_required()
def update_issue(issue_id):
    user_id = get_jwt_identity()
    issue = Issue.query.get_or_404(issue_id)
    
    if issue.user_id != user_id and not User.query.get(user_id).is_admin:
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.json
    if 'title' in data:
        issue.title = data['title']
    if 'description' in data:
        issue.description = data['description']
    if 'category' in data:
        issue.category = data['category']
    
    db.session.commit()
    return jsonify(format_issue(issue, user_id))

@app.route('/api/issues/<int:issue_id>/status', methods=['PUT'])
@jwt_required()
def update_issue_status(issue_id):
    user = User.query.get(get_jwt_identity())
    if not user.is_admin:
        return jsonify({"error": "Unauthorized"}), 403
    
    issue = Issue.query.get_or_404(issue_id)
    new_status = request.json.get('status')
    
    if not new_status or new_status not in ["Reported", "In Progress", "Resolved"]:
        return jsonify({"error": "Invalid status"}), 400
    
    issue.status = new_status
    log = StatusLog(issue_id=issue_id, status=new_status, admin_id=user.id)
    db.session.add(log)
    db.session.commit()
    
    return jsonify(format_issue(issue))

@app.route('/api/issues/<int:issue_id>/upvote', methods=['POST'])
@jwt_required()
def upvote_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    issue.upvotes += 1
    db.session.commit()
    return jsonify({"upvotes": issue.upvotes})

@app.route('/api/issues/<int:issue_id>/flag', methods=['POST'])
@jwt_required()
def flag_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    issue.flags += 1
    
    if issue.flags >= 5:  # Auto-hide if flagged by 5 users
        issue.status = "Flagged"
        log = StatusLog(issue_id=issue_id, status="Flagged")
        db.session.add(log)
    
    db.session.commit()
    return jsonify({"flags": issue.flags})

# Admin Routes
@app.route('/api/admin/issues', methods=['GET'])
@jwt_required()
def get_all_issues():
    user = User.query.get(get_jwt_identity())
    if not user.is_admin:
        return jsonify({"error": "Unauthorized"}), 403
    
    issues = Issue.query.all()
    return jsonify([format_issue(issue) for issue in issues])

@app.route('/api/admin/issues/<int:issue_id>', methods=['DELETE'])
@jwt_required()
def delete_issue(issue_id):
    user = User.query.get(get_jwt_identity())
    if not user.is_admin:
        return jsonify({"error": "Unauthorized"}), 403
    
    issue = Issue.query.get_or_404(issue_id)
    db.session.delete(issue)
    db.session.commit()
    return jsonify({"message": "Issue deleted"})

# Static Files
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)