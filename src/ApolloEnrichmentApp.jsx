import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, Loader2, Key, Trash2, Plus, LogOut } from 'lucide-react';
import ExcelJS from 'exceljs';

const ApolloEnrichmentApp = () => {
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

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = user?.token;

  const BATCH_SIZE = 10;
  const WAIT_TIME = 2000;

  const authFetch = async (url, method = 'GET', body = null) => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    const res = await fetch(`${API_BASE}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = '/';
      throw new Error('Session expired. Please log in again.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/';
      return;
    }
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const data = await authFetch('/api/api-keys');
      setApiKeys(data);
      if (data.length && !currentKeyId) {
        const unused = data.find((k) => k.status === 'unused') || data[0];
        setCurrentKeyId(unused.id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const addApiKey = async () => {
    if (!newKeyEmail.trim() || !newKey.trim()) {
      setError('Email and API key required');
      return;
    }
    try {
      await authFetch('/api/api-keys', 'POST', {
        apollo_email: newKeyEmail.trim(),
        api_key: newKey.trim(),
      });
      setNewKey('');
      setNewKeyEmail('');
      fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetApiKey = async (id) => {
    try {
      await authFetch(`/api/api-keys/${id}/reset`, 'PUT');
      fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeApiKey = async (id) => {
    try {
      await authFetch(`/api/api-keys/${id}`, 'DELETE');
      fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const activateApiKey = (id) => {
    setCurrentKeyId(id);
  };

  const rotateApiKey = async (exhaustedKeyId) => {
    try {
      if (exhaustedKeyId) {
        await authFetch(`/api/api-keys/${exhaustedKeyId}/mark-used`, 'PUT');
      }
      const list = await authFetch('/api/api-keys');
      const nextKey = list.find(k => k.status === 'unused') || list.find(k => k.id !== exhaustedKeyId);
      if (nextKey && nextKey.id) {
        setCurrentKeyId(nextKey.id);
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

  const apolloBulkMatch = async (batch, retryCount = 0) => {
    if (!currentKeyId) {
      throw new Error('No API key selected. Please add an API key first.');
    }

    try {
      const data = await authFetch('/api/apollo/bulk_match', 'POST', {
        apiKeyId: currentKeyId,
        details: batch,
      });
      return data.matches || [];
    } catch (err) {
      const errorInfo = {
        type: 'Bulk Match Error',
        message: err.message,
        endpoint: 'bulk_match',
        details: {}
      };

      if (err.message.includes('quota') || err.message.includes('limit') || err.message.includes('exhausted')) {
        if (retryCount < 3) {
          try {
            await rotateApiKey(currentKeyId);
            await new Promise(r => setTimeout(r, 1000));
            return apolloBulkMatch(batch, retryCount + 1);
          } catch (rotationError) {
            setApiErrors(prev => [...prev, errorInfo]);
            return [];
          }
        }
      }
      
      setApiErrors(prev => [...prev, errorInfo]);
      return [];
    }
  };

  const apolloSingleMatch = async (person, retryCount = 0) => {
    if (!currentKeyId) {
      throw new Error('No API key selected.');
    }

    try {
      const data = await authFetch('/api/apollo/single_match', 'POST', {
        apiKeyId: currentKeyId,
        first_name: person.first_name,
        last_name: person.last_name,
        organization_name: person.organization_name || '',
      });
      return data.person || null;
    } catch (err) {
      const errorInfo = {
        type: 'Single Match Error',
        message: err.message,
        endpoint: 'single_match',
        details: {}
      };

      if (err.message.includes('quota') || err.message.includes('limit') || err.message.includes('exhausted')) {
        if (retryCount < 3) {
          try {
            await rotateApiKey(currentKeyId);
            await new Promise(r => setTimeout(r, 1000));
            return apolloSingleMatch(person, retryCount + 1);
          } catch (rotationError) {
            setApiErrors(prev => [...prev, errorInfo]);
            return null;
          }
        }
      }

      setApiErrors(prev => [...prev, errorInfo]);
      return null;
    }
  };

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
    if (!currentKeyId) {
      setError('Please add and activate at least one API key before processing.');
      return;
    }

    setProcessing(true);
    setError('');
    setApiErrors([]);
    setProgress('📖 Reading Excel file...');

    try {
      const { jsonData } = await readExcelFile(file);

      let headerRow = null;
      let headerRowIndex = -1;
      const headerKeywords = ['first name', 'last name', 'name', 'company', 'firstname', 'lastname', 'fname', 'lname', 'companies'];
      
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row || !Array.isArray(row)) continue;
        const rowValues = row.map(cell => String(cell || '').trim().toLowerCase());
        const hasHeaderKeyword = headerKeywords.some(keyword => 
          rowValues.some(cell => cell.includes(keyword))
        );
        if (hasHeaderKeyword) {
          headerRow = row;
          headerRowIndex = i;
          break;
        }
      }

      if (!headerRow) {
        headerRow = jsonData.find(row => Array.isArray(row) && row.some(cell => cell));
        if (headerRow) headerRowIndex = jsonData.indexOf(headerRow);
      }

      if (!headerRow) throw new Error('No headers found in Excel');

      const headers = headerRow.map(h => String(h || '').trim().toLowerCase());

      const people = [];
      const originalCompanies = {};

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        let first = '', last = '', company = '';
        
        const firstNameIdx = headers.findIndex(h => 
          h === 'first name' || h === 'firstname' || h === 'fname' || h === 'first'
        );
        const lastNameIdx = headers.findIndex(h => 
          h === 'last name' || h === 'lastname' || h === 'lname' || h === 'last'
        );
        const nameIdx = headers.findIndex(h => 
          h === 'name' || h === 'full name' || h === 'fullname'
        );
        const companyIdx = headers.findIndex(h => 
          h === 'company name' || h === 'company' || h === 'companyname' || 
          h === 'organization' || h === 'org' || h === 'companies'
        );

        if (firstNameIdx !== -1 && lastNameIdx !== -1) {
          first = String(row[firstNameIdx] || '').trim();
          last = String(row[lastNameIdx] || '').trim();
        } else if (nameIdx !== -1) {
          const nameParts = String(row[nameIdx] || '').trim().split(' ');
          if (nameParts.length > 1) {
            first = nameParts[0];
            last = nameParts.slice(1).join(' ');
          } else if (nameParts.length === 1) {
            first = nameParts[0];
            last = '';
          }
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
        } catch (err) {
          console.error('Batch processing error:', err);
        }
      }

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
                if (apolloWords.length < 2 || origWords[0] !== apolloWords[0] || origWords[1] !== apolloWords[1]) 
                  isMismatch = true;
              }
              
              if (isMismatch) record.match_status = 'Mismatch';
            }
          }
        }
      }

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
      setApiErrors(prev => [...prev, {
        type: 'Processing Error',
        message: err.message,
        endpoint: 'process_excel',
        details: {}
      }]);
    } finally {
      setProcessing(false);
    }
  };

  const downloadResults = async () => {
    if (!results) return;
    setProgress('📝 Generating Excel file...');

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

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      results.data.forEach((record) => {
        const row = worksheet.addRow(record);
        
        let fillColor = null;
        if (record.match_status === 'Not Found') {
          fillColor = 'FFFFFF00';
        } else if (record.match_status === 'Mismatch') {
          fillColor = 'FFFF0000';
        } else if (record.match_status === 'Found' && !record.email) {
          fillColor = 'FFFFA500';
        }

        if (fillColor) {
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: fillColor }
            };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
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

  const getStatusColor = (status, hasEmail) => {
    if (status === 'Not Found') return 'bg-yellow-100 text-yellow-800';
    if (status === 'Mismatch') return 'bg-red-100 text-red-800';
    if (status === 'Found' && !hasEmail) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };


return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">Apollo Data Enrichment</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKeyManager(!showKeyManager)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition"
              >
                <Key size={16} />
                {showKeyManager ? 'Hide' : 'Manage'} API Keys
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>

        {showKeyManager && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">API Key Management</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
              <input
                type="email"
                value={newKeyEmail}
                onChange={(e) => setNewKeyEmail(e.target.value)}
                placeholder="Apollo account email"
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="API key"
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={addApiKey}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add Key
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Key size={48} className="mx-auto mb-3 opacity-30" />
                <p>No API keys configured. Add one to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className={`flex items-center justify-between p-3 rounded border-2 transition ${
                      k.id === currentKeyId 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{k.apollo_email}</p>
                        {k.id === currentKeyId && (
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-600 text-white">
                            Active
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          k.status === 'used' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {k.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {k.id !== currentKeyId && (
                        <button
                          onClick={() => activateApiKey(k.id)}
                          className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                        >
                          Activate
                        </button>
                      )}
                      {k.status === 'used' && (
                        <button
                          onClick={() => resetApiKey(k.id)}
                          className="text-sm text-green-600 hover:text-green-700"
                        >
                          Reset
                        </button>
                      )}
                      <button
                        onClick={() => removeApiKey(k.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition"
          >
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {file ? file.name : 'Click to upload Excel file'}
            </p>
            <p className="text-sm text-gray-500">
              Supports .xlsx and .xls files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
            />
          </div>

          {file && (
            <button
              onClick={processExcel}
              disabled={processing}
              className="w-full mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg disabled:bg-gray-400 hover:bg-indigo-700 flex items-center justify-center gap-2 transition font-medium"
            >
              {processing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Start Enrichment
                </>
              )}
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
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            apiError.statusCode >= 500 
                              ? 'bg-red-100 text-red-700' 
                              : apiError.statusCode >= 400 
                              ? 'bg-orange-100 text-orange-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {apiError.statusCode}
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-800">{apiError.type}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{apiError.message}</p>
                      {apiError.endpoint && (
                        <p className="text-xs text-gray-500 mt-2">
                          Endpoint: <span className="font-mono">{apiError.endpoint}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setApiErrors([])}
              className="mt-4 text-sm text-orange-700 hover:text-orange-900 font-medium"
            >
              Clear Errors
            </button>
          </div>
        )}


        {/* Results */}
        {results && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Results</h2>
              <button
                onClick={downloadResults}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
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
                <p className="text-center text-gray-500 text-sm mt-4">
                  Showing 10 of {results.data.length} records. Download Excel for full results.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApolloEnrichmentApp;