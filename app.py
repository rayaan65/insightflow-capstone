from flask import Flask, render_template, request, jsonify, send_from_directory, redirect, url_for, session, flash
import pandas as pd
import numpy as np
import os
import json
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from io import BytesIO
import base64
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
import secrets


app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['STATIC_FOLDER'] = 'static'
app.secret_key = secrets.token_hex(16)  # Generate a secure secret key

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['STATIC_FOLDER'], 'images'), exist_ok=True)

# Store uploaded dataframes and users in memory
session_data = {}
users = {}

@app.route('/')
def index():
    return render_template('index.html', logged_in='user_id' in session)

@app.route('/privacy')
def privacy_policy():
    return render_template('privacy_policy.html', logged_in='user_id' in session)

@app.route('/terms')
def terms_of_service():
    return render_template('terms.html', logged_in='user_id' in session)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        if email in users and check_password_hash(users[email]['password'], password):
            session['user_id'] = email
            return redirect(url_for('index'))
        else:
            flash('Invalid email or password')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        if email in users:
            flash('Email already registered')
        else:
            users[email] = {
                'password': generate_password_hash(password),
                'uploads': []
            }
            session['user_id'] = email
            return redirect(url_for('index'))
    
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('index'))

@app.route('/upload', methods=['POST'])
def upload_file():
    # Check if user is logged in
    if 'user_id' not in session:
        return jsonify({'error': 'Please login to upload files', 'redirect': '/login'})

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    
    if file:
        # Generate a session ID for this upload
        session_id = str(uuid.uuid4())
        
        # Save file temporarily
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{session_id}_{file.filename}")
        file.save(file_path)
        
        try:
            # Determine file type and read accordingly
            file_extension = os.path.splitext(file.filename)[1].lower()
            
            if file_extension in ['.xlsx', '.xls']:
                # Read Excel file
                df = pd.read_excel(file_path)
            elif file_extension == '.csv':
                # Read CSV file
                df = pd.read_csv(file_path)
            else:
                return jsonify({'error': 'Unsupported file format. Please upload .csv, .xlsx, or .xls files.'})
            
            # Store dataframe in memory
            session_data[session_id] = {
                'df': df,
                'filename': file.filename,
                'user_id': session['user_id']  # Associate the upload with the user
            }
            
            # Update user's uploads
            if session['user_id'] in users:
                if 'uploads' not in users[session['user_id']]:
                    users[session['user_id']]['uploads'] = []
                users[session['user_id']]['uploads'].append(session_id)
            
            # Get basic info about the dataframe
            columns = df.columns.tolist()
            dtypes = df.dtypes.apply(lambda x: str(x)).to_dict()
            preview = df.head(5).to_dict(orient='records')
            stats = {
                'rows': len(df),
                'columns': len(columns),
                'missing_values': df.isna().sum().to_dict()
            }
            
            return jsonify({
                'success': True,
                'session_id': session_id,
                'columns': columns,
                'dtypes': dtypes,
                'preview': preview,
                'stats': stats
            })
            
        except Exception as e:
            return jsonify({'error': str(e)})

@app.route('/analyze', methods=['POST'])
def analyze():
    # Check if user is logged in
    if 'user_id' not in session:
        return jsonify({'error': 'Please login to analyze data', 'redirect': '/login'})
        
    data = request.json
    session_id = data.get('session_id')
    analysis_type = data.get('analysis_type')
    
    if session_id not in session_data:
        return jsonify({'error': 'Session expired or invalid'})
    
    # Check if the user owns this upload
    if session_data[session_id]['user_id'] != session['user_id']:
        return jsonify({'error': 'Unauthorized access to this data'})
    
    df = session_data[session_id]['df']
    
    if analysis_type == 'summary':
        # Generate summary statistics
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        summary = df[numeric_cols].describe().to_dict()
        
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    elif analysis_type == 'correlation':
        # Generate correlation matrix for numeric columns
        numeric_df = df.select_dtypes(include=[np.number])
        
        # Check if there are too many columns for correlation analysis
        if numeric_df.shape[1] > 50:
            return jsonify({
                'error': 'Too many columns for visual matrix. Please upload a filtered file.'
            })
            
        if numeric_df.shape[1] < 2:
            return jsonify({'error': 'Need at least 2 numeric columns for correlation'})
        
        # Flag to indicate if we limited the columns
        limited_columns = False
        original_column_count = numeric_df.shape[1]
        columns_message = ""
        
        # If there are more than 10 numeric columns, select the most varying ones
        if numeric_df.shape[1] > 10:
            limited_columns = True
            # Calculate variance for each column
            variances = numeric_df.var().sort_values(ascending=False)
            # Select top 10 columns with highest variance
            top_columns = variances.index[:10].tolist()
            numeric_df = numeric_df[top_columns]
            columns_message = f"Matrix limited to top 10 numeric columns (out of {original_column_count}) for performance."
            
        # Calculate correlation matrix
        corr_matrix = numeric_df.corr().to_dict()
        
        # Create correlation heatmap using seaborn for better visualization
        try:
            import seaborn as sns
            plt.figure(figsize=(10, 8))
            
            # Create a mask for the upper triangle to show only lower triangle
            mask = np.triu(np.ones_like(numeric_df.corr(), dtype=bool))
            
            # Generate heatmap with seaborn
            sns.heatmap(
                numeric_df.corr(),
                mask=mask,
                annot=True,
                fmt=".2f",
                cmap="coolwarm",
                square=True,
                linewidths=0.5,
                cbar_kws={"shrink": 0.8}
            )
            
            plt.title("Correlation Matrix", fontsize=14, pad=20)
            plt.tight_layout()
        except ImportError:
            # Fallback to matplotlib if seaborn is not available
            plt.figure(figsize=(10, 8))
            plt.matshow(numeric_df.corr(), fignum=1)
            plt.colorbar()
            plt.xticks(range(len(numeric_df.columns)), numeric_df.columns, rotation=90)
            plt.yticks(range(len(numeric_df.columns)), numeric_df.columns)
        
        # Save plot to a temporary file
        img_path = os.path.join(app.config['STATIC_FOLDER'], 'images', f"{session_id}_correlation.png")
        plt.savefig(img_path, dpi=100, bbox_inches='tight')
        plt.close()
        
        return jsonify({
            'success': True,
            'correlation': corr_matrix,
            'plot_url': f"/static/images/{session_id}_correlation.png",
            'limited_columns': limited_columns,
            'message': columns_message
        })
        
    elif analysis_type == 'histogram':
        column = data.get('column')
        if column not in df.columns:
            return jsonify({'error': 'Column not found'})
            
        if not pd.api.types.is_numeric_dtype(df[column]):
            return jsonify({'error': 'Column must be numeric for histogram'})
        
        plt.figure(figsize=(10, 6))
        plt.hist(df[column].dropna(), bins=30, alpha=0.7, color='#6B21A8')
        plt.title(f'Histogram of {column}', fontsize=14)
        plt.xlabel(column, fontsize=12)
        plt.ylabel('Frequency', fontsize=12)
        plt.grid(axis='y', linestyle='--', alpha=0.3)
        plt.tight_layout(pad=3.0)
        
        # Save plot
        img_path = os.path.join(app.config['STATIC_FOLDER'], 'images', f"{session_id}_histogram.png")
        plt.savefig(img_path)
        plt.close()
        
        return jsonify({
            'success': True,
            'plot_url': f"/static/images/{session_id}_histogram.png"
        })
        
    elif analysis_type == 'bar':
        try:
            # Extract parameters with detailed logging
            category_col = data.get('category_column')
            value_col = data.get('value_column')
            chart_type = data.get('chart_type', 'bar')  # Default to bar if not specified
            
            print(f"DEBUG: Full request data: {data}")
            print(f"DEBUG: Chart generation requested - Type: {chart_type}, Category: {category_col}, Value: {value_col}")
            
            # Force chart_type to a valid value if it's empty or invalid
            if not chart_type or chart_type not in ['bar', 'pie', 'line']:
                print(f"DEBUG: Invalid chart type '{chart_type}', defaulting to 'bar'")
                chart_type = 'bar'
            
            if category_col not in df.columns or value_col not in df.columns:
                return jsonify({'error': f'One or more columns not found. Available columns: {", ".join(df.columns)}'})
                
            if not pd.api.types.is_numeric_dtype(df[value_col]):
                return jsonify({'error': 'Value column must be numeric for charts'})
                
            # Ensure we have valid data
            if df.empty:
                return jsonify({'error': 'Dataset is empty'})
                
            # Aggregate data by category and get top 10
            try:
                grouped_data = df.groupby(category_col)[value_col].mean().sort_values(ascending=False).head(10)
                
                # Check if we have any data after grouping
                if grouped_data.empty:
                    return jsonify({'error': 'No data available after grouping'})
                    
                # Convert to categorical for proper ordering
                categories = grouped_data.index.tolist()
                values = grouped_data.values
                
                print(f"DEBUG: Grouped data - Categories: {categories}, Values: {values}")
                
                plt.figure(figsize=(10, 7))
                
                if chart_type == 'pie':
                    # Create a pie chart with enhanced styling
                    colors = plt.cm.Purples(np.linspace(0.5, 0.9, len(categories)))
                    wedges, texts, autotexts = plt.pie(
                        values, 
                        labels=None,  # We'll add custom legend instead
                        autopct='%1.1f%%', 
                        startangle=90, 
                        shadow=True, 
                        explode=[0.05] * len(categories),
                        colors=colors, 
                        textprops={'color': 'white', 'fontweight': 'bold', 'fontsize': 12},
                        wedgeprops={'edgecolor': 'white', 'linewidth': 1}
                    )
                    
                    # Enhance the appearance of percentage text
                    for autotext in autotexts:
                        autotext.set_fontsize(10)
                        autotext.set_bbox(dict(facecolor='#6B21A8', alpha=0.6, edgecolor='none', boxstyle='round,pad=0.3'))
                    
                    plt.title(f'Pie Chart: {value_col} by {category_col} (Top 10)', fontsize=14, pad=20)
                    plt.axis('equal')  # Equal aspect ratio ensures the pie chart is circular
                    
                    # Add a legend with category names
                    plt.legend(
                        wedges, 
                        categories, 
                        title="Categories", 
                        loc="center left", 
                        bbox_to_anchor=(1, 0, 0.5, 1),
                        fontsize=9
                    )
                    
                elif chart_type == 'line':
                    # Create a line chart with enhanced styling
                    plt.plot(
                        range(len(categories)), 
                        values, 
                        marker='o', 
                        linestyle='-', 
                        linewidth=3, 
                        color='#6B21A8', 
                        markersize=10,
                        markerfacecolor='#EC4899',
                        markeredgecolor='white',
                        markeredgewidth=2
                    )
                    
                    plt.title(f'Line Chart: {value_col} by {category_col} (Top 10)', fontsize=14, pad=20)
                    plt.ylabel(value_col, fontsize=12)
                    plt.xlabel(category_col, fontsize=12)
                    plt.grid(True, linestyle='--', alpha=0.7)
                    
                    # Set x-ticks to category names with better formatting
                    plt.xticks(range(len(categories)), categories, rotation=45, ha='right')
                    
                    # Add gradient background
                    plt.gca().patch.set_facecolor('#f8f9fa')
                    
                    # Add value labels above each point with enhanced styling
                    for i, val in enumerate(values):
                        # Format with K, M, B notation
                        if val >= 1_000_000_000:
                            formatted_value = f'{val/1_000_000_000:.1f}B'
                        elif val >= 1_000_000:
                            formatted_value = f'{val/1_000_000:.1f}M'
                        elif val >= 1_000:
                            formatted_value = f'{val/1_000:.1f}K'
                        else:
                            formatted_value = f'{val:.1f}'
                            
                        plt.text(
                            i, val * 1.05, 
                            formatted_value, 
                            ha='center', 
                            va='bottom',
                            fontweight='bold',
                            fontsize=10,
                            bbox=dict(
                                facecolor='#EC4899', 
                                alpha=0.8, 
                                edgecolor='white',
                                boxstyle='round,pad=0.3',
                                linewidth=1
                            )
                        )
                        
                else:  # Default bar chart
                    # Use vertical bar chart with improved styling and gradient colors
                    color_gradient = plt.cm.Purples(np.linspace(0.5, 0.9, len(categories)))
                    bars = plt.bar(
                        categories, 
                        values, 
                        color=color_gradient, 
                        alpha=0.9, 
                        width=0.6,
                        edgecolor='white',
                        linewidth=1
                    )
                    
                    plt.title(f'Bar Graph: {value_col} by {category_col} (Top 10)', fontsize=14, pad=20)
                    plt.ylabel(value_col, fontsize=12)
                    plt.xlabel(category_col, fontsize=12)
                    plt.grid(axis='y', linestyle='--', alpha=0.7)
                    
                    # Format x-axis to show category names properly
                    plt.xticks(rotation=45, ha='right')
                    
                    # Add value labels on top of bars with K, M, B notation
                    # Get the y-axis limits to ensure labels stay within bounds
                    y_min, y_max = plt.ylim()
                    plt.ylim(y_min, y_max * 1.1)  # Add 10% extra space at the top
                    
                    for i, bar in enumerate(bars):
                        height = bar.get_height()
                        # Format with K, M, B notation
                        if height >= 1_000_000_000:
                            formatted_value = f'{height/1_000_000_000:.1f}B'
                        elif height >= 1_000_000:
                            formatted_value = f'{height/1_000_000:.1f}M'
                        elif height >= 1_000:
                            formatted_value = f'{height/1_000:.1f}K'
                        else:
                            formatted_value = f'{height:.1f}'
                        
                        # Position the text at 98% of the height to ensure it stays inside
                        plt.text(
                            i, 
                            height * 0.98, 
                            formatted_value, 
                            ha='center', 
                            va='top', 
                            fontweight='bold', 
                            fontsize=10, 
                            color='white', 
                            bbox=dict(
                                facecolor='#6B21A8', 
                                alpha=0.8, 
                                pad=2, 
                                boxstyle='round,pad=0.3'
                            )
                        )
                
                # Set background color for better visibility
                plt.gca().set_facecolor('#f8f9fa')
                plt.tight_layout(pad=3.0)  # Add padding to ensure everything fits
                
                # Save plot with higher DPI for better quality
                # Use different filenames for different chart types to prevent caching issues
                if chart_type == 'pie':
                    img_path = os.path.join(app.config['STATIC_FOLDER'], 'images', f"{session_id}_pie_chart.png")
                elif chart_type == 'line':
                    img_path = os.path.join(app.config['STATIC_FOLDER'], 'images', f"{session_id}_line_chart.png")
                else:
                    img_path = os.path.join(app.config['STATIC_FOLDER'], 'images', f"{session_id}_bar_chart.png")
                
                plt.savefig(img_path, dpi=100, bbox_inches='tight')
                plt.close()
                
                print(f"DEBUG: Chart saved successfully to {img_path}")
                
                return jsonify({
                    'success': True,
                    'plot_url': f"/static/images/{os.path.basename(img_path)}",
                    'chart_type': chart_type  # Include chart type in response
                })
                
            except Exception as e:
                print(f"ERROR: Error during data grouping or chart generation: {str(e)}")
                return jsonify({'error': f'Error generating chart: {str(e)}'})
                
        except Exception as e:
            print(f"ERROR: Unexpected error in chart generation: {str(e)}")
            return jsonify({'error': f'Unexpected error: {str(e)}'})
        
    elif analysis_type == 'scatter':
        x_col = data.get('x_column')
        y_col = data.get('y_column')
        
        if x_col not in df.columns or y_col not in df.columns:
            return jsonify({'error': 'One or more columns not found'})
            
        if not (pd.api.types.is_numeric_dtype(df[x_col]) and pd.api.types.is_numeric_dtype(df[y_col])):
            return jsonify({'error': 'Both columns must be numeric for scatter plot'})
        
        plt.figure(figsize=(10, 6))
        plt.scatter(df[x_col], df[y_col], alpha=0.7, color='#6B21A8', edgecolor='white', s=50)
        plt.title(f'Scatter Plot: {x_col} vs {y_col}', fontsize=14)
        plt.xlabel(x_col, fontsize=12)
        plt.ylabel(y_col, fontsize=12)
        plt.grid(alpha=0.3, linestyle='--')
        plt.tight_layout(pad=3.0)
        
        # Save plot
        img_path = os.path.join(app.config['STATIC_FOLDER'], 'images', f"{session_id}_scatter.png")
        plt.savefig(img_path)
        plt.close()
        
        return jsonify({
            'success': True,
            'plot_url': f"/static/images/{session_id}_scatter.png"
        })
    
    return jsonify({'error': 'Invalid analysis type'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
