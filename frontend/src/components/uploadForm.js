import React, { useState } from "react";
import axios from "axios";

const UploadResume = () => {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState("");

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("resume", file);

    const response = await axios.post("http://localhost:5000/api/resume/upload", formData);
    setAnalysis(response.data.analysis);
  };

  return (
    <div>
      <h2>Upload Resume</h2>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Analyze</button>
      <p>{analysis}</p>
    </div>
  );
};

export default UploadResume;
