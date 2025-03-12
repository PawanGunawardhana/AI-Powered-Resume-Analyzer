from flask import Flask, request, jsonify
import openai
import os

app = Flask(__name__)

# Load API Key
openai.api_key = os.getenv("OPENAI_API_KEY")

@app.route('/analyze', methods=['POST'])
def analyze_resume():
    data = request.json
    resume_text = data.get("resumeText", "")

    if not resume_text:
        return jsonify({"error": "Resume text required"}), 400

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "system", "content": "Extract key skills from the following resume:"},
                      {"role": "user", "content": resume_text}]
        )

        return jsonify({"skills": response.choices[0].message["content"]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
