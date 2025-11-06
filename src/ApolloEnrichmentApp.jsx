// import React, { useState, useRef, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   Upload,
//   Download,
//   AlertCircle,
//   CheckCircle,
//   Loader2,
//   Key,
//   LogOut,
// } from "lucide-react";
// import ExcelJS from "exceljs";

// const ApolloEnrichmentApp = () => {
//   const navigate = useNavigate();
//   const [file, setFile] = useState(null);
//   const [processing, setProcessing] = useState(false);
//   const [progress, setProgress] = useState("");
//   const [results, setResults] = useState(null);
//   const [error, setError] = useState("");
//   const [apiErrors, setApiErrors] = useState([]);
//   const [apiKeys, setApiKeys] = useState([]);
//   const [currentKeyId, setCurrentKeyId] = useState(
//     Number(localStorage.getItem("currentKeyId")) || null
//   );
//   const [showKeyManager, setShowKeyManager] = useState(false);
//   const [newKey, setNewKey] = useState("");
//   const [newKeyEmail, setNewKeyEmail] = useState("");
//   const fileInputRef = useRef(null);

//   // ✅ Backend base URL (from .env)
//   const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
//   const user = JSON.parse(localStorage.getItem("user") || "{}");
//   const token = user?.token;

//   // 🔐 Helper fetch with Authorization header
//   const authFetch = async (url, method = "GET", body = null) => {
//     const headers = {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${token}`,
//     };
//     const res = await fetch(`${API_BASE}${url}`, {
//       method,
//       headers,
//       body: body ? JSON.stringify(body) : undefined,
//     });
//     if (res.status === 401 || res.status === 403) {
//       localStorage.clear();
//       navigate("/");
//       throw new Error("Session expired. Please log in again.");
//     }
//     const data = await res.json().catch(() => ({}));
//     if (!res.ok) throw new Error(data.error || "Request failed");
//     return data;
//   };

//   // ✅ Load API keys on mount
//   useEffect(() => {
//     if (!token) {
//       navigate("/");
//       return;
//     }
//     fetchApiKeys();
//   }, []);

//   const handleLogout = () => {
//     localStorage.clear();
//     navigate("/");
//   };

//   // ---------------- API KEY MANAGEMENT ----------------
//   const fetchApiKeys = async () => {
//     try {
//       const data = await authFetch("/api/api-keys");
//       setApiKeys(data);
//       if (data.length && !currentKeyId) {
//         const unused = data.find((k) => k.status === "unused") || data[0];
//         setCurrentKeyId(unused.id);
//         localStorage.setItem("currentKeyId", unused.id);
//       }
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   const addApiKey = async () => {
//     if (!newKeyEmail.trim() || !newKey.trim()) {
//       setError("Email and API key required");
//       return;
//     }
//     try {
//       await authFetch("/api/api-keys", "POST", {
//         apollo_email: newKeyEmail.trim(),
//         api_key: newKey.trim(),
//       });
//       setNewKey("");
//       setNewKeyEmail("");
//       fetchApiKeys();
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   const resetApiKey = async (id) => {
//     try {
//       await authFetch(`/api/api-keys/${id}/reset`, "PUT");
//       fetchApiKeys();
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   const removeApiKey = async (id) => {
//     try {
//       await authFetch(`/api/api-keys/${id}`, "DELETE");
//       fetchApiKeys();
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   const activateApiKey = (id) => {
//     setCurrentKeyId(id);
//     localStorage.setItem("currentKeyId", String(id));
//   };

//   // ---------------- FILE UPLOAD ----------------
//   const readExcelFile = async (file) => {
//     const workbook = new ExcelJS.Workbook();
//     const arrayBuffer = await file.arrayBuffer();
//     await workbook.xlsx.load(arrayBuffer);
//     const worksheet = workbook.worksheets[0];
//     const jsonData = [];
//     worksheet.eachRow((row) => jsonData.push(row.values));
//     return { workbook, jsonData };
//   };

//   // ---------------- APOLLO PROXY CALLS ----------------
//   const apolloBulkMatch = async (batch) => {
//     try {
//       const data = await authFetch("/api/apollo/bulk_match", "POST", {
//         apiKeyId: currentKeyId,
//         details: batch,
//       });
//       return data.matches || [];
//     } catch (err) {
//       setApiErrors((prev) => [...prev, { type: "Apollo Bulk", message: err.message }]);
//       return [];
//     }
//   };

//   const apolloSingleMatch = async (person) => {
//     try {
//       const data = await authFetch("/api/apollo/single_match", "POST", {
//         apiKeyId: currentKeyId,
//         first_name: person.first_name,
//         last_name: person.last_name,
//         organization_name: person.organization_name || "",
//       });
//       return data.person || null;
//     } catch (err) {
//       setApiErrors((prev) => [...prev, { type: "Apollo Single", message: err.message }]);
//       return null;
//     }
//   };

//   // ---------------- EXCEL PROCESSING ----------------
//   const processExcel = async () => {
//     if (!file) return;
//     setProcessing(true);
//     setProgress("📖 Reading Excel...");
//     try {
//       const { jsonData } = await readExcelFile(file);
//       const headers = jsonData[0].map((h) => h.toLowerCase());
//       const people = jsonData.slice(1).map((r) => ({
//         first_name: r[headers.indexOf("first name")] || "",
//         last_name: r[headers.indexOf("last name")] || "",
//         organization_name: r[headers.indexOf("company name")] || "",
//       }));

//       const results = [];
//       for (const person of people) {
//         const matches = await apolloBulkMatch([person]);
//         if (matches.length) {
//           results.push({ ...person, ...matches[0], status: "Found" });
//         } else {
//           const single = await apolloSingleMatch(person);
//           results.push({
//             ...person,
//             ...single,
//             status: single ? "Found" : "Not Found",
//           });
//         }
//       }

//       setResults(results);
//       setProcessing(false);
//       setProgress("✅ Completed!");
//     } catch (err) {
//       setError(err.message);
//       setProcessing(false);
//     }
//   };

//   const downloadResults = async () => {
//     if (!results) return;
//     const workbook = new ExcelJS.Workbook();
//     const ws = workbook.addWorksheet("Results");
//     ws.columns = Object.keys(results[0]).map((key) => ({
//       header: key,
//       key,
//       width: 20,
//     }));
//     results.forEach((r) => ws.addRow(r));
//     const buffer = await workbook.xlsx.writeBuffer();
//     const blob = new Blob([buffer], {
//       type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "apollo_results.xlsx";
//     a.click();
//     URL.revokeObjectURL(url);
//   };

//   // ---------------- UI ----------------
//   return (
//     <div
//       className="min-h-screen p-6"
//       style={{
//         background:
//           "linear-gradient(to bottom right, rgba(87, 194, 147, 0.1), rgba(87, 194, 147, 0.15))",
//       }}
//     >
//       <div className="max-w-6xl mx-auto">
//         {/* Header */}
//         <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
//           <div className="flex items-center justify-between mb-2">
//             <h1 className="text-3xl font-bold text-gray-800">
//               Apollo Data Enrichment
//             </h1>
//             <div className="flex items-center gap-2">
//               <button
//                 onClick={() => setShowKeyManager(!showKeyManager)}
//                 className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
//               >
//                 <Key size={16} />
//                 Manage API Keys
//               </button>
//               <button
//                 onClick={handleLogout}
//                 className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition"
//               >
//                 <LogOut size={16} />
//                 Logout
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* API Key Manager */}
//         {showKeyManager && (
//           <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
//             <h2 className="text-xl font-semibold mb-4">API Key Management</h2>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
//               <input
//                 type="email"
//                 value={newKeyEmail}
//                 onChange={(e) => setNewKeyEmail(e.target.value)}
//                 placeholder="Apollo account email"
//                 className="border p-2 rounded"
//               />
//               <input
//                 type="text"
//                 value={newKey}
//                 onChange={(e) => setNewKey(e.target.value)}
//                 placeholder="API key"
//                 className="border p-2 rounded"
//               />
//               <button
//                 onClick={addApiKey}
//                 className="bg-green-600 text-white px-4 py-2 rounded"
//               >
//                 Add Key
//               </button>
//             </div>

//             {apiKeys.length === 0 ? (
//               <p className="text-gray-500">No API keys found.</p>
//             ) : (
//               apiKeys.map((k) => (
//                 <div
//                   key={k.id}
//                   className="flex items-center justify-between bg-gray-50 rounded p-3 mb-2"
//                 >
//                   <div>
//                     <p className="font-medium flex items-center gap-2">
//                       {k.apollo_email}
//                       {k.id === currentKeyId && (
//                         <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
//                           active
//                         </span>
//                       )}
//                     </p>
//                     <small
//                       className={`px-2 py-1 rounded ${
//                         k.status === "used"
//                           ? "bg-red-100 text-red-700"
//                           : "bg-green-100 text-green-700"
//                       }`}
//                     >
//                       {k.status}
//                     </small>
//                   </div>
//                   <div className="flex gap-2">
//                     {k.id !== currentKeyId && (
//                       <button
//                         onClick={() => activateApiKey(k.id)}
//                         className="text-sm bg-green-600 text-white px-3 py-1 rounded"
//                       >
//                         Activate
//                       </button>
//                     )}
//                     {k.status === "used" && (
//                       <button
//                         onClick={() => resetApiKey(k.id)}
//                         className="text-sm text-green-600"
//                       >
//                         Reset
//                       </button>
//                     )}
//                     <button
//                       onClick={() => removeApiKey(k.id)}
//                       className="text-sm text-red-600"
//                     >
//                       Delete
//                     </button>
//                   </div>
//                 </div>
//               ))
//             )}
//           </div>
//         )}

//         {/* File Upload */}
//         <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
//           <div
//             onClick={() => fileInputRef.current?.click()}
//             className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer"
//           >
//             <Upload className="mx-auto mb-4 text-gray-400" size={48} />
//             <p className="text-lg font-medium text-gray-700 mb-2">
//               {file ? file.name : "Click to upload Excel file"}
//             </p>
//             <input
//               ref={fileInputRef}
//               type="file"
//               accept=".xlsx,.xls"
//               onChange={(e) => setFile(e.target.files[0])}
//               className="hidden"
//             />
//           </div>

//           {file && (
//             <button
//               onClick={processExcel}
//               disabled={processing}
//               className="w-full mt-6 px-6 py-3 text-white rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2"
//               style={{
//                 backgroundColor: processing ? "#9ca3af" : "rgb(60,160,117)",
//               }}
//             >
//               <CheckCircle size={20} />
//               {processing ? "Processing..." : "Start Enrichment"}
//             </button>
//           )}
//         </div>

//         {/* Progress */}
//         {progress && (
//           <div className="bg-white rounded shadow p-4 mb-6 flex gap-2 items-center">
//             {processing ? (
//               <Loader2 className="animate-spin" size={20} />
//             ) : (
//               <CheckCircle size={20} />
//             )}
//             <p>{progress}</p>
//           </div>
//         )}

//         {/* Errors */}
//         {error && (
//           <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 mb-6 flex items-center gap-2">
//             <AlertCircle size={20} /> {error}
//           </div>
//         )}

//         {/* Results */}
//         {results && (
//           <div className="bg-white rounded-lg shadow p-8">
//             <div className="flex justify-between items-center mb-4">
//               <h2 className="text-xl font-bold">Results</h2>
//               <button
//                 onClick={downloadResults}
//                 className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
//               >
//                 <Download size={16} /> Download Excel
//               </button>
//             </div>
//             <p className="text-gray-600 mb-2">
//               {results.length} enriched records
//             </p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ApolloEnrichmentApp;
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, AlertCircle, CheckCircle, Loader2, Key, LogOut } from 'lucide-react';
import ExcelJS from 'exceljs';

const ApolloEnrichmentApp = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [apiErrors, setApiErrors] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [currentKeyId, setCurrentKeyId] = useState(null);
  const [showKeyManager, setShowKeyManager] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newKeyEmail, setNewKeyEmail] = useState('');
  const fileInputRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = user?.token;

  // ---------------- UTILS ----------------
  const maskKey = (key) => {
    if (!key || typeof key !== 'string') return '';
    if (key.length <= 8) return `${key[0]}***${key[key.length - 1]}`;
    return `${key.slice(0, 4)}***${key.slice(-4)}`;
  };

  const logDebug = (...args) => {
    console.debug('[ApolloEnrichment]', ...args);
  };

  // Batch controls
  const BATCH_SIZE = 10;
  const WAIT_TIME = 2000; // ms

  // Identify API exhaustion errors from status/data
  const isApiExhaustionError = (statusCode, responseData) => {
    if (statusCode === 422 || statusCode === 429 || statusCode === 403) return true;
    const from = (responseData && (responseData.error || responseData.message)) || "";
    const msg = String(from).toLowerCase();
    return (
      msg.includes('quota') ||
      msg.includes('limit') ||
      msg.includes('exhausted') ||
      msg.includes('rate limit') ||
      msg.includes('access denied') ||
      msg.includes('forbidden')
    );
  };

  // Format error for UI
  const formatApiError = (statusCode, responseData, endpoint) => {
    let errorType = 'Unknown Error';
    let errorMessage = 'An error occurred while processing your request.';
    const errorCode = responseData?.error_code || null;

    if (responseData?.error) errorMessage = responseData.error;
    else if (responseData?.message) errorMessage = responseData.message;

    if (isApiExhaustionError(statusCode, responseData)) {
      if (statusCode === 403) {
        errorType = 'API Access Denied (403)';
        if (!responseData?.error) errorMessage = 'The API key does not have access to this resource or has been disabled.';
      } else if (statusCode === 429) {
        errorType = 'Rate Limit Exceeded (429)';
        if (!responseData?.error) errorMessage = 'API rate limit has been exceeded. Please wait before retrying.';
      } else if (statusCode === 422) {
        errorType = 'Quota Exhausted (422)';
        if (!responseData?.error) errorMessage = 'API quota has been exhausted for this key.';
      } else {
        errorType = 'API Key Exhausted';
        if (!responseData?.error) errorMessage = 'The API key has reached its usage limit.';
      }
    } else if (statusCode >= 400 && statusCode < 500) {
      errorType = `Client Error (${statusCode})`;
      if (!responseData?.error && !responseData?.message) errorMessage = `The request was invalid (${statusCode}).`;
    } else if (statusCode >= 500) {
      errorType = `Server Error (${statusCode})`;
      if (!responseData?.error && !responseData?.message) errorMessage = `The API server encountered an error (${statusCode}).`;
    }

    return {
      type: errorType,
      message: errorMessage,
      statusCode,
      errorCode,
      endpoint,
      details: responseData,
    };
  };

  const authFetch = async (url, method = "GET", body = null) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(`${API_BASE}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      navigate("/");
      throw new Error("Session expired. Please log in again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  // ---------------- LOAD KEYS ----------------
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const data = await authFetch('/api/api-keys');
      setApiKeys(data);
      if (data.length && !currentKeyId) {
        const unused = data.find((k) => k.status === "unused") || data[0];
        setCurrentKeyId(unused.id);
        localStorage.setItem("currentKeyId", unused.id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const addApiKey = async () => {
    if (!newKeyEmail.trim() || !newKey.trim()) {
      setError("Email and API key required");
      return;
    }
    try {
      await authFetch("/api/api-keys", "POST", {
        apollo_email: newKeyEmail.trim(),
        api_key: newKey.trim(),
      });
      setNewKey("");
      setNewKeyEmail("");
      fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetApiKey = async (id) => {
    try {
      await authFetch(`/api/api-keys/${id}/reset`, "PUT");
      fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeApiKey = async (id) => {
    try {
      await authFetch(`/api/api-keys/${id}`, "DELETE");
      fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const activateApiKey = (id) => {
    setCurrentKeyId(id);
    localStorage.setItem('currentKeyId', id);
  };

  const rotateApiKey = async (exhaustedKeyId) => {
    try {
      if (exhaustedKeyId) {
        await authFetch(`/api/api-keys/${exhaustedKeyId}/mark-used`, "PUT");
      }
      // Fetch current list and choose next unused
      const list = await authFetch('/api/api-keys');
      const nextKey = list.find(k => k.status === 'unused') || list.find(k => k.id !== exhaustedKeyId);
      if (nextKey && nextKey.id) {
        setCurrentKeyId(nextKey.id);
        localStorage.setItem('currentKeyId', nextKey.id);
        setApiKeys(list);
        setProgress(`⚠️ API key exhausted. Rotating to next unused key (${nextKey.apollo_email})`);
        return nextKey.id;
      }
      throw new Error('No unused API keys available. Please add or reset keys.');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // ---------------- APOLLO CALLS ----------------
  const apolloBulkMatch = async (batch, retryCount = 0) => {
    const url = `${API_BASE}/api/apollo/bulk_match`;
    const headers = {
      accept: 'application/json',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const payload = { apiKeyId: currentKeyId, details: batch };

    try {
      const startedAt = Date.now();
      logDebug('Request → bulk_match', { currentKeyId, url, count: batch?.length || 0 });
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      logDebug('Response ← bulk_match', { status: response.status, ok: response.ok, ms: Date.now() - startedAt });

      let responseText = '';
      let responseData = {};
      try {
        responseText = await response.text();
        if (responseText) responseData = JSON.parse(responseText);
      } catch (_) {}

      if (response.status >= 400 && response.status < 600) {
        const errorInfo = formatApiError(response.status, responseData, 'bulk_match');
        if (isApiExhaustionError(response.status, responseData)) {
          if (retryCount < 10) {
            try {
              await rotateApiKey(currentKeyId);
              await new Promise(r => setTimeout(r, 1000));
              return apolloBulkMatch(batch, retryCount + 1);
            } catch (rotationError) {
              setApiErrors(prev => [...prev, errorInfo]);
              return [];
            }
          } else {
            setApiErrors(prev => [...prev, { ...errorInfo, message: errorInfo.message + ' (Max retry attempts reached)' }]);
            return [];
          }
        } else {
          setApiErrors(prev => [...prev, errorInfo]);
          return [];
        }
      }

      if (!response.ok) {
        const errorInfo = formatApiError(response.status, responseData, 'bulk_match');
        setApiErrors(prev => [...prev, errorInfo]);
        return [];
      }

      const data = responseData.matches || (responseText ? JSON.parse(responseText) : {}).matches || [];
      return data;
    } catch (err) {
      let errorType = 'Network Error';
      let errorMessage = err.message || 'Failed to connect to API';
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorType = 'Network Connection Error';
        errorMessage = 'Unable to connect to Apollo API. Please check your internet connection.';
      } else if (err.message.includes('timeout')) {
        errorType = 'Request Timeout';
        errorMessage = 'The request to Apollo API timed out. Please try again.';
      }
      setApiErrors(prev => [...prev, { type: errorType, message: errorMessage, statusCode: null, errorCode: 'NETWORK_ERROR', endpoint: 'bulk_match', details: { originalError: err.message } }]);
      return [];
    }
  };

  const apolloSingleMatch = async (person, retryCount = 0) => {
    const url = `${API_BASE}/api/apollo/single_match`;
    const headers = {
      accept: 'application/json',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const payload = {
      apiKeyId: currentKeyId,
      first_name: person.first_name,
      last_name: person.last_name,
      organization_name: person.organization_name || '',
    };

    try {
      const startedAt = Date.now();
      logDebug('Request → single_match', { currentKeyId, url, payload: { ...payload, apiKeyId: 'masked' } });
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      logDebug('Response ← single_match', { status: response.status, ok: response.ok, ms: Date.now() - startedAt });

      let responseText = '';
      let responseData = {};
      try {
        responseText = await response.text();
        if (responseText) responseData = JSON.parse(responseText);
      } catch (_) {}

      if (response.status >= 400 && response.status < 600) {
        const errorInfo = formatApiError(response.status, responseData, 'single_match');
        if (isApiExhaustionError(response.status, responseData)) {
          if (retryCount < 10) {
            try {
              await rotateApiKey(currentKeyId);
              await new Promise(r => setTimeout(r, 1000));
              return apolloSingleMatch(person, retryCount + 1);
            } catch (rotationError) {
              setApiErrors(prev => [...prev, errorInfo]);
              return null;
            }
          } else {
            setApiErrors(prev => [...prev, { ...errorInfo, message: errorInfo.message + ' (Max retry attempts reached)' }]);
            return null;
          }
        } else {
          setApiErrors(prev => [...prev, errorInfo]);
          return null;
        }
      }

      if (!response.ok) {
        const errorInfo = formatApiError(response.status, responseData, 'single_match');
        setApiErrors(prev => [...prev, errorInfo]);
        return null;
      }

      const data = responseData.person || (responseText ? JSON.parse(responseText) : {}).person || null;
      return data;
    } catch (err) {
      let errorType = 'Network Error';
      let errorMessage = err.message || 'Failed to connect to API';
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorType = 'Network Connection Error';
        errorMessage = 'Unable to connect to Apollo API. Please check your internet connection.';
      } else if (err.message.includes('timeout')) {
        errorType = 'Request Timeout';
        errorMessage = 'The request to Apollo API timed out. Please try again.';
      }
      setApiErrors(prev => [...prev, { type: errorType, message: errorMessage, statusCode: null, errorCode: 'NETWORK_ERROR', endpoint: 'single_match', details: { originalError: err.message } }]);
      return null;
    }
  };

  // ---------------- EXCEL ----------------
  const readExcelFile = async (file) => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    const jsonData = [];
    worksheet.eachRow((row) => jsonData.push(row.values));
    return { workbook, jsonData };
  };

  const processExcel = async () => {
    if (!file) return;
    setProcessing(true);
    setError('');
    setApiErrors([]);
    setProgress('📖 Reading Excel file...');
    try {
      const { jsonData } = await readExcelFile(file);

      // Flexible header detection
      let headerRow = null;
      let headerRowIndex = -1;
      const headerKeywords = ['first name', 'last name', 'name', 'company', 'firstname', 'lastname', 'fname', 'lname','companies'];
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row || !Array.isArray(row)) continue;
        const rowValues = row.map(cell => String(cell || '').trim().toLowerCase());
        const hasHeaderKeyword = headerKeywords.some(keyword => rowValues.some(cell => cell.includes(keyword)));
        if (hasHeaderKeyword) { headerRow = row; headerRowIndex = i; break; }
      }
      if (!headerRow) {
        headerRow = jsonData.find(row => Array.isArray(row) && row.some(cell => cell));
        if (headerRow) headerRowIndex = jsonData.indexOf(headerRow);
      }
      if (!headerRow) throw new Error('No headers found in Excel');

      const headers = headerRow.map(h => String(h || '').trim().toLowerCase());

      // Extract people data
      const people = [];
      const originalCompanies = {};
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        let first = '', last = '', company = '';
        const firstNameIdx = headers.findIndex(h => h === 'first name' || h === 'firstname' || h === 'fname' || h === 'first');
        const lastNameIdx = headers.findIndex(h => h === 'last name' || h === 'lastname' || h === 'lname' || h === 'last');
        const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname');
        const companyIdx = headers.findIndex(h => h === 'company name' || h === 'company' || h === 'companyname' || h === 'organization' || h === 'org');
        if (firstNameIdx !== -1 && lastNameIdx !== -1) {
          first = String(row[firstNameIdx] || '').trim();
          last = String(row[lastNameIdx] || '').trim();
        } else if (nameIdx !== -1) {
          const nameParts = String(row[nameIdx] || '').trim().split(' ');
          if (nameParts.length > 1) { first = nameParts[0]; last = nameParts.slice(1).join(' '); }
          else if (nameParts.length === 1) { first = nameParts[0]; last = ''; }
        }
        if (companyIdx !== -1) company = String(row[companyIdx] || '').trim();
        if (first || last) {
          const entry = { first_name: first, last_name: last };
          if (company) entry.organization_name = company;
          people.push(entry);
          const key = `${first.toLowerCase()}|${last.toLowerCase()}`;
          originalCompanies[key] = company;
        }
      }

      setProgress(`✅ Found ${people.length} people to process`);

      // STEP 1: Bulk enrichment in batches
      setProgress('🚀 Starting bulk enrichment...');
      const results = [];
      const totalBatches = Math.ceil(people.length / BATCH_SIZE);
      for (let b = 0; b < totalBatches; b++) {
        const batch = people.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        setProgress(`🚀 Processing batch ${b + 1}/${totalBatches} (${batch.length} people)...`);
        try {
          const matches = await apolloBulkMatch(batch);
          for (let i = 0; i < batch.length; i++) {
            const person = batch[i];
            const match = matches && i < matches.length && matches[i] ? matches[i] : null;
            if (match) {
              results.push({
                first_name: match.first_name || '',
                last_name: match.last_name || '',
                email: match.email || '',
                title: match.title || '',
                linkedin_url: match.linkedin_url || '',
                company_name: match.organization?.name || '',
                company_website: match.organization?.website_url || '',
                match_status: 'Found',
              });
            } else {
              results.push({
                first_name: person.first_name || '',
                last_name: person.last_name || '',
                email: '',
                title: '',
                linkedin_url: '',
                company_name: person.organization_name || '',
                company_website: '',
                match_status: 'Not Found',
              });
            }
          }
          if (b < totalBatches - 1) {
            setProgress(`⏳ Waiting ${WAIT_TIME / 1000} seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
          }
        } catch (_) {
          // continue with next batch
        }
      }

      // STEP 2: Retry not found with single match
      const notFoundIndices = results
        .map((r, idx) => (r.match_status === 'Not Found' ? idx : -1))
        .filter(idx => idx !== -1);
      if (notFoundIndices.length > 0) {
        setProgress(`🔄 Retrying ${notFoundIndices.length} not found records...`);
        for (let i = 0; i < notFoundIndices.length; i++) {
          const idx = notFoundIndices[i];
          const record = results[idx];
          setProgress(`🔄 Retrying ${i + 1}/${notFoundIndices.length}: ${record.first_name} ${record.last_name}`);
          const match = await apolloSingleMatch({
            first_name: record.first_name,
            last_name: record.last_name,
            organization_name: record.company_name || null,
          });
          if (match) {
            results[idx] = {
              first_name: match.first_name || record.first_name,
              last_name: match.last_name || record.last_name,
              email: match.email || '',
              title: match.title || '',
              linkedin_url: match.linkedin_url || '',
              company_name: match.organization?.name || record.company_name,
              company_website: match.organization?.website_url || '',
              match_status: 'Found',
            };
          }
          await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
        }
      }

      // STEP 3: Company mismatch detection
      setProgress('🔍 Checking for company mismatches...');
      for (let record of results) {
        if (record.match_status === 'Found' && record.first_name && record.last_name && record.company_name) {
          const key = `${record.first_name.toLowerCase()}|${record.last_name.toLowerCase()}`;
          const originalCompany = originalCompanies[key] || '';
          if (originalCompany && record.company_name) {
            const origClean = originalCompany.toLowerCase().trim();
            const apolloClean = record.company_name.toLowerCase().trim();
            if (origClean !== apolloClean) {
              const origWords = origClean.split(/\s+/);
              const apolloWords = apolloClean.split(/\s+/);
              let isMismatch = false;
              if (origWords.length === 1) {
                if (!apolloWords.length || origWords[0] !== apolloWords[0]) isMismatch = true;
              } else if (origWords.length === 2) {
                if (!apolloWords.length || origWords[0] !== apolloWords[0]) isMismatch = true;
              } else {
                if (apolloWords.length < 2 || origWords[0] !== apolloWords[0] || origWords[1] !== apolloWords[1]) isMismatch = true;
              }
              if (isMismatch) record.match_status = 'Mismatch';
            }
          }
        }
      }

      // Stats
      const stats = {
        total: results.length,
        found: results.filter(r => r.match_status === 'Found' && r.email).length,
        foundNoEmail: results.filter(r => r.match_status === 'Found' && !r.email).length,
        notFound: results.filter(r => r.match_status === 'Not Found').length,
        mismatch: results.filter(r => r.match_status === 'Mismatch').length,
      };

      setResults({ data: results, stats });
      setProgress('✅ Processing complete!');
    } catch (err) {
      setError(`Error: ${err.message}`);
      setApiErrors(prev => [...prev, { type: 'Processing Error', message: err.message, statusCode: null, endpoint: 'process_excel', details: {} }]);
    } finally {
      setProcessing(false);
    }
  };

  const downloadResults = async () => {
    if (!results) return;
    setProgress('📝 Generating colored Excel file...');
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Results');

      worksheet.columns = [
        { header: 'First Name', key: 'first_name', width: 15 },
        { header: 'Last Name', key: 'last_name', width: 15 },
        { header: 'Company Name', key: 'company_name', width: 25 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Linkedin Url', key: 'linkedin_url', width: 40 },
        { header: 'Company Website', key: 'company_website', width: 30 },
        { header: 'Match Status', key: 'match_status', width: 12 },
      ];

      // Header styling
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      results.data.forEach((record) => {
        const row = worksheet.addRow({
          first_name: record.first_name,
          last_name: record.last_name,
          company_name: record.company_name,
          title: record.title,
          email: record.email,
          linkedin_url: record.linkedin_url,
          company_website: record.company_website,
          match_status: record.match_status,
        });

        let fillColor = null;
        if (record.match_status === 'Not Found') fillColor = 'FFFFFF00'; // Yellow
        else if (record.match_status === 'Mismatch') fillColor = 'FFFF0000'; // Red
        else if (record.match_status === 'Found') {
          const hasEmail = record.email && String(record.email).trim() !== '';
          if (!hasEmail) fillColor = 'FFFFA500'; // Orange
        }

        if (fillColor) {
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'apollo_enrichment_results.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setProgress('✅ Download complete!');
    } catch (err) {
      setError(`Error generating Excel: ${err.message}`);
    }
  };

  // Utility for status pill color
  const getStatusColor = (status, hasEmail) => {
    if (status === 'Not Found') return 'bg-yellow-100 text-yellow-800';
    if (status === 'Mismatch') return 'bg-red-100 text-red-800';
    if (status === 'Found' && !hasEmail) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(to bottom right, rgba(87, 194, 147, 0.1), rgba(87, 194, 147, 0.15))' }}>
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-800">Apollo Data Enrichment</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowKeyManager(!showKeyManager)} className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                <Key size={16} />
                Manage Keys
              </button>
              <button onClick={() => { localStorage.clear(); navigate('/'); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition">
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* API KEY MANAGER */}
        {showKeyManager && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">API Key Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
              <input type="email" value={newKeyEmail} onChange={(e) => setNewKeyEmail(e.target.value)} placeholder="Apollo account email" className="border p-2 rounded" />
              <input type="text" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="API key" className="border p-2 rounded" />
              <button onClick={addApiKey} className="bg-green-600 text-white px-4 py-2 rounded">Add Key</button>
            </div>
            {apiKeys.map((k) => (
              <div key={k.id} className="flex justify-between items-center border-b py-2">
                <div>
                  <p className="flex items-center gap-2">
                    {k.apollo_email}
                    {k.id === currentKeyId && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">Active</span>
                    )}
                  </p>
                  <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">

                   
                  </div>
                  <small className="block mt-1">{k.status}</small>
                </div>
                <div className="flex gap-2">
                  {k.id !== currentKeyId && (
                    <button onClick={() => activateApiKey(k.id)} className="text-sm bg-green-600 text-white px-3 py-1 rounded">Activate</button>
                  )}
                  {k.status === 'used' && (
                    <button onClick={() => resetApiKey(k.id)} className="text-sm text-green-600">Reset</button>
                  )}
                  <button onClick={() => removeApiKey(k.id)} className="text-sm text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FILE UPLOAD + RESULTS */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer">
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {file ? file.name : 'Click to upload Excel file'}
            </p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
          </div>
          {file && (
            <button onClick={processExcel} disabled={processing} className="w-full mt-6 px-6 py-3 text-white rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2" style={{ backgroundColor: processing ? '#9ca3af' : 'rgb(60,160,117)' }}>
              <CheckCircle size={20} />
              {processing ? 'Processing...' : 'Start Enrichment'}
            </button>
          )}
        </div>

        {progress && (
          <div className="bg-white rounded shadow p-4 mb-6 flex gap-2 items-center">
            {processing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
            <p>{progress}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 mb-6 flex items-center gap-2">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {/* API Errors */}
        {apiErrors.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="text-orange-600 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="text-orange-800 font-semibold mb-2">API Errors ({apiErrors.length})</h3>
              </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {apiErrors.map((apiError, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {apiError.statusCode && (
                          <span className={`${apiError.statusCode >= 500 ? 'bg-red-100 text-red-700' : apiError.statusCode >= 400 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'} px-2 py-1 rounded text-xs font-medium`}>
                            {apiError.statusCode}
                          </span>
                        )}
                        {apiError.errorCode && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">{apiError.errorCode}</span>
                        )}
                        <span className="text-sm font-medium text-gray-800">{apiError.type}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{apiError.message}</p>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        {apiError.endpoint && (
                          <span>Endpoint: <span className="font-mono">{apiError.endpoint}</span></span>
                        )}
                        {apiError.errorCode && apiError.statusCode && (
                          <span>Error Code: <span className="font-mono font-medium">{apiError.errorCode}</span></span>
                        )}
                      </div>
                    </div>
                  </div>
                  {apiError.details && Object.keys(apiError.details).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">View Details</summary>
                      <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">{JSON.stringify(apiError.details, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setApiErrors([])} className="mt-4 text-sm text-orange-700 hover:text-orange-900 font-medium">Clear Errors</button>
          </div>
        )}

        {results && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Results</h2>
              <button onClick={downloadResults} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
                <Download size={20} /> Download Excel
              </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-800">{results.stats.total}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">✅ Found</p>
                <p className="text-2xl font-bold text-green-700">{results.stats.found}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">🟠 No Email</p>
                <p className="text-2xl font-bold text-orange-700">{results.stats.foundNoEmail}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">🟡 Not Found</p>
                <p className="text-2xl font-bold text-yellow-700">{results.stats.notFound}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">🔴 Mismatch</p>
                <p className="text-2xl font-bold text-red-700">{results.stats.mismatch}</p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Company</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Title</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.data.slice(0, 10).map((record, idx) => (
                    <tr key={idx} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">{record.first_name} {record.last_name}</td>
                      <td className="px-4 py-3">{record.company_name}</td>
                      <td className="px-4 py-3">{record.title}</td>
                      <td className="px-4 py-3">{record.email || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.match_status, record.email)}`}>
                          {record.match_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.data.length > 10 && (
                <p className="text-center text-gray-500 text-sm mt-4">Showing 10 of {results.data.length} records. Download Excel for full results.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApolloEnrichmentApp;
