import React, { useState } from 'react';
import axios from 'axios';

function UploadForm() {
    const [resumeText, setResumeText] = useState('');
    const [result, setResult] = useState(null);

    const handleUpload = async () => {
        try {
            const response = await axios.post('http://localhost:5000/api/upload', {
                name: "John Doe",
                email: "johndoe@example.com",
                resumeText
            });
            setResult(response.data.parsedData);
        } catch (error) {
            console.error("❌ Upload Error:", error.response?.data || error.message);
        }
    };

    return (
        <div>
            <textarea placeholder="Paste your resume here..." onChange={(e) => setResumeText(e.target.value)}></textarea>
            <button onClick={handleUpload}>Analyze Resume</button>
            {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
        </div>
    );
}

export default UploadForm;
