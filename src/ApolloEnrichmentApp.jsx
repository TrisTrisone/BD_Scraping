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

  // Debug helpers
  const maskKey = (key) => {
    if (!key || typeof key !== 'string') return '';
    if (key.length <= 8) return `${key[0]}***${key[key.length - 1]}`;
    return `${key.slice(0, 4)}***${key.slice(-4)}`;
  };
  const logDebug = (...args) => {
    // Centralize debug logging so it can be toggled later if needed
    // eslint-disable-next-line no-console
    console.debug('[ApolloEnrichment]', ...args);
  };

  useEffect(() => {
    // Check if user is logged in
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/');
      return;
    }
    
    // Restore previously selected key if available
    const savedKeyId = localStorage.getItem('currentKeyId');
    if (savedKeyId) {
      const parsed = Number(savedKeyId);
      if (!Number.isNaN(parsed)) {
        setCurrentKeyId(parsed);
      }
    }
    
    // Fetch API keys from database
    fetchApiKeys();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const BATCH_SIZE = 10;
  const WAIT_TIME = 2000;

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/api-keys');
      if (response.ok) {
        const keys = await response.json();
        logDebug('Fetched API keys:', { count: keys.length, ids: keys.map(k => k.id) });
        setApiKeys(keys);
        // Set current key to first unused key if available
        if (keys.length > 0 && !currentKeyId) {
          // Prefer saved selection if valid
          const savedKeyId = Number(localStorage.getItem('currentKeyId'));
          const savedExists = keys.some(k => k.id === savedKeyId);
          if (savedExists) {
            setCurrentKeyId(savedKeyId);
            logDebug('Restored saved currentKeyId', savedKeyId);
          } else {
            const unusedKey = keys.find(k => k.status === 'unused') || keys[0];
            setCurrentKeyId(unusedKey.id);
            localStorage.setItem('currentKeyId', String(unusedKey.id));
            logDebug('Set currentKeyId to', unusedKey.id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching API keys:', err);
    }
  };

  const addApiKey = async () => {
    if (!newKey.trim() || !newKeyEmail.trim()) {
      setError('Both email and API key are required');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apollo_email: newKeyEmail.trim(),
          api_key: newKey.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add API key');
      }

      setNewKey('');
      setNewKeyEmail('');
      fetchApiKeys();
      logDebug('API key added successfully', { id: data?.id });
    } catch (err) {
      setError(err.message);
      logDebug('Add API key failed', { message: err?.message });
    }
  };

  const removeApiKey = async (id) => {
    if (apiKeys.length <= 1) {
      setError('Cannot remove the last API key');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/api-keys/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      await fetchApiKeys();
      logDebug('API key deleted', { id });
      
      // Reset current key if it was deleted
      if (currentKeyId === id) {
        const remainingKeys = apiKeys.filter(k => k.id !== id);
        if (remainingKeys.length > 0) {
          const unusedKey = remainingKeys.find(k => k.status === 'unused') || remainingKeys[0];
          setCurrentKeyId(unusedKey.id);
        }
      }
    } catch (err) {
      setError(err.message);
      logDebug('Delete API key failed', { id, message: err?.message });
    }
  };

  const resetApiKey = async (id) => {
    try {
      const response = await fetch(`http://localhost:3001/api/api-keys/${id}/reset`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('Failed to reset API key');
      }

      await fetchApiKeys();
      logDebug('API key reset to unused', { id });
    } catch (err) {
      setError(err.message);
      logDebug('Reset API key failed', { id, message: err?.message });
    }
  };

  const getCurrentApiKey = () => {
    const currentKey = apiKeys.find(k => k.id === currentKeyId);
    if (!currentKey) {
      logDebug('getCurrentApiKey: no active key selected', { currentKeyId });
    } else {
      logDebug('getCurrentApiKey: using key', { currentKeyId, masked: maskKey(currentKey.api_key) });
    }
    return currentKey ? currentKey.api_key : null;
  };

  const markKeyAsUsed = async (id) => {
    try {
      await fetch(`http://localhost:3001/api/api-keys/${id}/mark-used`, {
        method: 'PUT',
      });
    } catch (err) {
      console.error('Error marking key as used:', err);
    }
  };

  const getNextUnusedKey = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/api-keys/next-unused');
      if (response.ok) {
        const key = await response.json();
        return key;
      }
    } catch (err) {
      console.error('Error fetching next unused key:', err);
    }
    return null;
  };

  const rotateApiKey = async (exhaustedKeyId) => {
    // Mark exhausted key as used
    if (exhaustedKeyId) {
      await markKeyAsUsed(exhaustedKeyId);
      logDebug('Marked exhausted key as used', { exhaustedKeyId });
    }

    // Get next unused key
    const nextKey = await getNextUnusedKey();
    
    if (nextKey) {
      setCurrentKeyId(nextKey.id);
      localStorage.setItem('currentKeyId', String(nextKey.id));
      // Refresh keys to get updated statuses
      await fetchApiKeys();
      setProgress(`⚠️ API key exhausted. Rotating to next unused key (${nextKey.apollo_email})`);
      logDebug('Rotated to next unused key', { id: nextKey.id });
      return nextKey.api_key;
    } else {
      setError('No unused API keys available. Please add more keys or reset existing ones.');
      throw new Error('No unused API keys available');
    }
  };

  // Allow manual activation of an API key
  const activateApiKey = (id) => {
    setCurrentKeyId(id);
    localStorage.setItem('currentKeyId', String(id));
    logDebug('Manually activated API key', { id });
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError('');
      setResults(null);
    }
  };



    const readExcelFile = async (file) => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    const jsonData = [];
    worksheet.eachRow((row) => {
        jsonData.push(row.values);
    });
    return { workbook, jsonData };
    };

  // Helper function to identify API exhaustion errors
  const isApiExhaustionError = (statusCode, responseData) => {
    // Check status codes
    if (statusCode === 422 || statusCode === 429 || statusCode === 403) {
      return true;
    }
    
    // Check error messages
    if (responseData && responseData.error) {
      const errorMsg = String(responseData.error).toLowerCase();
      return errorMsg.includes('quota') || 
             errorMsg.includes('limit') || 
             errorMsg.includes('exhausted') ||
             errorMsg.includes('rate limit') ||
             errorMsg.includes('access denied') ||
             errorMsg.includes('forbidden');
    }
    
    // Check status text
    if (responseData && responseData.message) {
      const msg = String(responseData.message).toLowerCase();
      return msg.includes('quota') || 
             msg.includes('limit') || 
             msg.includes('exhausted') ||
             msg.includes('rate limit');
    }
    
    return false;
  };

  // Helper function to format API errors
  const formatApiError = (statusCode, responseData, endpoint) => {
    let errorType = 'Unknown Error';
    let errorMessage = 'An error occurred while processing your request.';
    const errorCode = responseData?.error_code || null;
    
    // Use the actual error message from API if available
    if (responseData?.error) {
      errorMessage = responseData.error;
    } else if (responseData?.message) {
      errorMessage = responseData.message;
    }
    
    if (isApiExhaustionError(statusCode, responseData)) {
      if (statusCode === 403) {
        errorType = 'API Access Denied (403)';
        if (!responseData?.error) {
          errorMessage = 'The API key does not have access to this resource or has been disabled.';
        }
      } else if (statusCode === 429) {
        errorType = 'Rate Limit Exceeded (429)';
        if (!responseData?.error) {
          errorMessage = 'API rate limit has been exceeded. Please wait before retrying.';
        }
      } else if (statusCode === 422) {
        errorType = 'Quota Exhausted (422)';
        if (!responseData?.error) {
          errorMessage = 'API quota has been exhausted for this key.';
        }
      } else {
        errorType = 'API Key Exhausted';
        if (!responseData?.error) {
          errorMessage = 'The API key has reached its usage limit.';
        }
      }
    } else if (statusCode >= 400 && statusCode < 500) {
      errorType = `Client Error (${statusCode})`;
      if (!responseData?.error && !responseData?.message) {
        errorMessage = `The request was invalid (${statusCode}).`;
      }
    } else if (statusCode >= 500) {
      errorType = `Server Error (${statusCode})`;
      if (!responseData?.error && !responseData?.message) {
        errorMessage = `The API server encountered an error (${statusCode}).`;
      }
    }
    
    return {
      type: errorType,
      message: errorMessage,
      statusCode,
      errorCode,
      endpoint,
      details: responseData
    };
  };

  const apolloBulkMatch = async (peopleBatch, retryCount = 0) => {
    const currentKey = getCurrentApiKey();
    if (!currentKey) {
      throw new Error('No API key available');
    }

    const url = "http://localhost:3001/api/apollo/bulk_match";
    const headers = {
      "accept": "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json"
    };
    const payload = { apiKey: currentKey, details: peopleBatch };

    try {
      const startedAt = Date.now();
      logDebug('Request → bulk_match', {
        currentKeyId,
        key: maskKey(currentKey),
        url,
        payloadCount: Array.isArray(peopleBatch) ? peopleBatch.length : 0,
        headers
      });
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      logDebug('Response ← bulk_match', { status: response.status, ok: response.ok, ms: Date.now() - startedAt });

      let responseText = '';
      let responseData = {};
      
      // Read response body once
      try {
        responseText = await response.text();
        if (responseText) {
          responseData = JSON.parse(responseText);
        }
      } catch (e) {
        // Response might not be JSON
      }

      // Handle 400-500 errors
      if (response.status >= 400 && response.status < 600) {
        const errorInfo = formatApiError(response.status, responseData, 'bulk_match');
        
        // Check if it's an API exhaustion error that requires rotation
        if (isApiExhaustionError(response.status, responseData)) {
          if (retryCount < 10) { // Limit retries to prevent infinite loop
            const exhaustedKeyId = currentKeyId;
            try {
              const newKey = await rotateApiKey(exhaustedKeyId);
              if (newKey) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return apolloBulkMatch(peopleBatch, retryCount + 1);
              }
            } catch (rotationError) {
              // If rotation fails, add error and return empty
              setApiErrors(prev => [...prev, errorInfo]);
              return [];
            }
          } else {
            // Max retries reached
            setApiErrors(prev => [...prev, {
              ...errorInfo,
              message: errorInfo.message + ' (Max retry attempts reached)'
            }]);
            return [];
          }
        } else {
          // Non-exhaustion error - log it but don't rotate
          setApiErrors(prev => [...prev, errorInfo]);
          if (response.status >= 500) {
            // Server error - return empty to continue with other batches
            return [];
          } else {
            // Client error - return empty
            return [];
          }
        }
      }

      if (!response.ok) {
        const errorInfo = formatApiError(response.status, responseData, 'bulk_match');
        setApiErrors(prev => [...prev, errorInfo]);
        logDebug('bulk_match not ok', { status: response.status, bodySnippet: (responseText || '').slice(0, 500) });
        return [];
      }

      const data = responseData.matches || (responseText ? JSON.parse(responseText) : {}).matches || [];
      return data;
    } catch (err) {
      console.error('Bulk match error:', err);
      logDebug('bulk_match network failure', {
        name: err?.name,
        message: err?.message,
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        hint: 'If name is TypeError and message is "Failed to fetch", this is often CORS or TLS/MITM blocking in browser.'
      });
      
      // Format network errors better
      let errorType = 'Network Error';
      let errorMessage = err.message || 'Failed to connect to API';
      
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorType = 'Network Connection Error';
        errorMessage = 'Unable to connect to Apollo API. Please check your internet connection.';
      } else if (err.message.includes('timeout')) {
        errorType = 'Request Timeout';
        errorMessage = 'The request to Apollo API timed out. Please try again.';
      }

      setApiErrors(prev => [...prev, {
        type: errorType,
        message: errorMessage,
        statusCode: null,
        errorCode: 'NETWORK_ERROR',
        endpoint: 'bulk_match',
        details: { originalError: err.message }
      }]);
      return [];
    }
  };

  const apolloSingleMatch = async (firstName, lastName, companyName = null, retryCount = 0) => {
    const currentKey = getCurrentApiKey();
    if (!currentKey) {
      return null;
    }

    const url = "http://localhost:3001/api/apollo/single_match";
    const headers = {
      "accept": "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json"
    };

    const payload = {
      first_name: firstName,
      last_name: lastName
    };

    if (companyName) {
      payload.organization_name = companyName;
    }

    try {
      const startedAt = Date.now();
      logDebug('Request → single_match', {
        currentKeyId,
        key: maskKey(currentKey),
        url,
        payload: { first_name: firstName, last_name: lastName, organization_name: companyName || undefined },
        headers: { ...headers, 'x-api-key': maskKey(headers['x-api-key']) }
      });
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ apiKey: currentKey, ...payload })
      });
      logDebug('Response ← single_match', { status: response.status, ok: response.ok, ms: Date.now() - startedAt });

      let responseText = '';
      let responseData = {};
      
      // Read response body once
      try {
        responseText = await response.text();
        if (responseText) {
          responseData = JSON.parse(responseText);
        }
      } catch (e) {
        // Response might not be JSON
      }

      // Handle 400-500 errors
      if (response.status >= 400 && response.status < 600) {
        const errorInfo = formatApiError(response.status, responseData, 'single_match');
        
        // Check if it's an API exhaustion error that requires rotation
        if (isApiExhaustionError(response.status, responseData)) {
          if (retryCount < 10) {
            const exhaustedKeyId = currentKeyId;
            try {
              const newKey = await rotateApiKey(exhaustedKeyId);
              if (newKey) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return apolloSingleMatch(firstName, lastName, companyName, retryCount + 1);
              }
            } catch (rotationError) {
              // If rotation fails, log error and return null
              setApiErrors(prev => [...prev, errorInfo]);
              return null;
            }
          } else {
            // Max retries reached
            setApiErrors(prev => [...prev, {
              ...errorInfo,
              message: errorInfo.message + ' (Max retry attempts reached)'
            }]);
            return null;
          }
        } else {
          // Non-exhaustion error - log it but don't rotate
          setApiErrors(prev => [...prev, errorInfo]);
          return null;
        }
      }

      if (!response.ok) {
        const errorInfo = formatApiError(response.status, responseData, 'single_match');
        setApiErrors(prev => [...prev, errorInfo]);
        logDebug('single_match not ok', { status: response.status, bodySnippet: (responseText || '').slice(0, 500) });
        return null;
      }

      const data = responseData.person || (responseText ? JSON.parse(responseText) : {}).person || null;
      return data;
    } catch (err) {
      console.error('Single match error:', err);
      logDebug('single_match network failure', {
        name: err?.name,
        message: err?.message,
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        hint: 'If name is TypeError and message is "Failed to fetch", this is often CORS or TLS/MITM blocking in browser.'
      });
      
      // Format network errors better
      let errorType = 'Network Error';
      let errorMessage = err.message || 'Failed to connect to API';
      
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorType = 'Network Connection Error';
        errorMessage = 'Unable to connect to Apollo API. Please check your internet connection.';
      } else if (err.message.includes('timeout')) {
        errorType = 'Request Timeout';
        errorMessage = 'The request to Apollo API timed out. Please try again.';
      }

      setApiErrors(prev => [...prev, {
        type: errorType,
        message: errorMessage,
        statusCode: null,
        errorCode: 'NETWORK_ERROR',
        endpoint: 'single_match',
        details: { originalError: err.message }
      }]);
      return null;
    }
  };

  const processExcel = async () => {
    if (!file) return;

    setProcessing(true);
    setError('');
    setApiErrors([]);
    setProgress('📖 Reading Excel file...');

    try {
      const { jsonData } = await readExcelFile(file);
      
      // Find header row with flexible detection
      let headerRow = null;
      let headerRowIndex = -1;
      
      // Try to find header row by looking for common header keywords
      const headerKeywords = ['first name', 'last name', 'name', 'company', 'firstname', 'lastname', 'fname', 'lname'];
      
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
      
      // Fallback: use first non-empty row if no headers found
      if (!headerRow) {
        headerRow = jsonData.find(row => Array.isArray(row) && row.some(cell => cell));
        if (headerRow) {
          headerRowIndex = jsonData.indexOf(headerRow);
        }
      }
      
      if (!headerRow) throw new Error('No headers found in Excel');

      const headers = headerRow.map(h => String(h || '').trim().toLowerCase());

      
      // Extract people data starting after header row
      const people = [];
      const originalCompanies = {};

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        let first = '', last = '', company = '';
        
        // Flexible header matching with variations
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
          h === 'company name' || h === 'company' || h === 'companyname' || h === 'organization' || h === 'org'
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

        if (companyIdx !== -1) {
          company = String(row[companyIdx] || '').trim();
        }

        if (first || last) {
          const entry = { first_name: first, last_name: last };
          if (company) {
            entry.organization_name = company;
          }
          people.push(entry);
          
          const key = `${first.toLowerCase()}|${last.toLowerCase()}`;
          originalCompanies[key] = company;
        }
      }

      setProgress(`✅ Found ${people.length} people to process`);

      // STEP 1: Bulk enrichment
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
                match_status: 'Found'
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
                match_status: 'Not Found'
              });
            }
          }

          if (b < totalBatches - 1) {
            setProgress(`⏳ Waiting ${WAIT_TIME / 1000} seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
          }
        } catch (err) {
          // Log the error and continue with next batch
          console.error('Batch processing error:', err);
        }
      }

      // STEP 2: Retry not found with single match
      const notFoundIndices = results
        .map((r, idx) => r.match_status === 'Not Found' ? idx : -1)
        .filter(idx => idx !== -1);

      if (notFoundIndices.length > 0) {
        setProgress(`🔄 Retrying ${notFoundIndices.length} not found records...`);

        for (let i = 0; i < notFoundIndices.length; i++) {
          const idx = notFoundIndices[i];
          const record = results[idx];
          
          setProgress(`🔄 Retrying ${i + 1}/${notFoundIndices.length}: ${record.first_name} ${record.last_name}`);

          const match = await apolloSingleMatch(
            record.first_name,
            record.last_name,
            record.company_name || null
          );

          if (match) {
            results[idx] = {
              first_name: match.first_name || record.first_name,
              last_name: match.last_name || record.last_name,
              email: match.email || '',
              title: match.title || '',
              linkedin_url: match.linkedin_url || '',
              company_name: match.organization?.name || record.company_name,
              company_website: match.organization?.website_url || '',
              match_status: 'Found'
            };
          }

          await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
        }
      }

      // STEP 3: Apply company mismatch logic
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
                if (!apolloWords.length || origWords[0] !== apolloWords[0]) {
                  isMismatch = true;
                }
              } else if (origWords.length === 2) {
                if (!apolloWords.length || origWords[0] !== apolloWords[0]) {
                  isMismatch = true;
                }
              } else {
                if (apolloWords.length < 2 || origWords[0] !== apolloWords[0] || origWords[1] !== apolloWords[1]) {
                  isMismatch = true;
                }
              }

              if (isMismatch) {
                record.match_status = 'Mismatch';
              }
            }
          }
        }
      }

      // Calculate statistics
      const stats = {
        total: results.length,
        found: results.filter(r => r.match_status === 'Found' && r.email).length,
        foundNoEmail: results.filter(r => r.match_status === 'Found' && !r.email).length,
        notFound: results.filter(r => r.match_status === 'Not Found').length,
        mismatch: results.filter(r => r.match_status === 'Mismatch').length
      };

      setResults({ data: results, stats });
      setProgress('✅ Processing complete!');
      setProcessing(false);

    } catch (err) {
      setError(`Error: ${err.message}`);
      setApiErrors(prev => [...prev, {
        type: 'Processing Error',
        message: err.message,
        statusCode: null,
        endpoint: 'process_excel',
        details: {}
      }]);
      setProcessing(false);
    }
  };

  const downloadResults = async () => {
    if (!results) return;

    setProgress('📝 Generating colored Excel file...');

    try {
      // Create a new workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Results');

      // Define columns
      worksheet.columns = [
        { header: 'First Name', key: 'first_name', width: 15 },
        { header: 'Last Name', key: 'last_name', width: 15 },
        { header: 'Company Name', key: 'company_name', width: 25 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Linkedin Url', key: 'linkedin_url', width: 40 },
        { header: 'Company Website', key: 'company_website', width: 30 },
        { header: 'Match Status', key: 'match_status', width: 12 }
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows with colors
      results.data.forEach((record) => {
        const row = worksheet.addRow({
          first_name: record.first_name,
          last_name: record.last_name,
          company_name: record.company_name,
          title: record.title,
          email: record.email,
          linkedin_url: record.linkedin_url,
          company_website: record.company_website,
          match_status: record.match_status
        });

        // Determine fill color based on match status
        let fillColor = null;
        
        if (record.match_status === 'Not Found') {
          fillColor = 'FFFFFF00'; // Yellow
        } else if (record.match_status === 'Mismatch') {
          fillColor = 'FFFF0000'; // Red
        } else if (record.match_status === 'Found') {
          const hasEmail = record.email && String(record.email).trim() !== '';
          if (!hasEmail) {
            fillColor = 'FFFFA500'; // Orange
          } 
        }

        // Apply fill color to all cells in the row
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

      // Generate buffer and download
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
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(to bottom right, rgba(87, 194, 147, 0.1), rgba(87, 194, 147, 0.15))' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-800">Apollo Data Enrichment</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKeyManager(!showKeyManager)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
              <Key size={16} />
              Manage API Keys ({apiKeys.filter(k => k.status === 'unused').length} unused)
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
          <p className="text-gray-600">Upload your Excel file to enrich contact data via Apollo API</p>
        </div>

        {/* API Key Manager */}
        {showKeyManager && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">API Key Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
              <input
                type="email"
                value={newKeyEmail}
                onChange={(e) => setNewKeyEmail(e.target.value)}
                placeholder="Apollo Account Email (@tristone-partners.com)"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'rgb(60,160,117)' }}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(87, 194, 147, 0.5)'}
                onBlur={(e) => e.target.style.boxShadow = ''}
              />
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Enter new API key"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(87, 194, 147, 0.5)'}
                onBlur={(e) => e.target.style.boxShadow = ''}
              />
              <button
                onClick={addApiKey}
                className="px-6 py-2 text-white rounded-lg transition"
                style={{ backgroundColor: 'rgb(60,160,117)' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(34, 117, 81)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgb(60,160,117)'}
              >
                Add Key
              </button>
            </div>
            <div className="space-y-2">
              {apiKeys.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No API keys found. Add one above to get started.</p>
              ) : (
                apiKeys.map((keyData) => (
                  <div key={keyData.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {keyData.id === currentKeyId && (
                          <span className="text-green-600 text-xs font-medium">● Active</span>
                        )}
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          keyData.status === 'used' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {keyData.status}
                        </span>
                      </div>
                      <div className="text-sm">
                        <div className="text-gray-700 mb-1">{keyData.apollo_email}</div>
                        <div className="font-mono text-xs text-gray-600">
                          {keyData.api_key.slice(0, 8)}...{keyData.api_key.slice(-4)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {keyData.id !== currentKeyId && (
                        <button
                          onClick={() => activateApiKey(keyData.id)}
                          className="text-sm px-3 py-1 rounded transition"
                          style={{ backgroundColor: 'rgb(60,160,117)', color: 'white' }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(34,117,81)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'rgb(60,160,117)'}
                          title="Activate this API key"
                        >
                          Activate
                        </button>
                      )}
                      {keyData.status === 'used' && (
                        <button
                          onClick={() => resetApiKey(keyData.id)}
                          className="text-sm transition"
                          style={{ color: 'rgb(60,160,117)' }}
                          onMouseEnter={(e) => e.target.style.color = 'rgb(34,117,81)'}
                          onMouseLeave={(e) => e.target.style.color = 'rgb(60,160,117)'}
                          title="Reset to unused"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer transition"
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'rgb(60,160,117)';
              e.target.style.backgroundColor = 'rgba(87, 194, 147, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {file ? file.name : 'Click to upload Excel file'}
            </p>
            <p className="text-sm text-gray-500">
              Expected format: Columns C-F with headers in row 2
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {file && (
            <button
              onClick={processExcel}
              disabled={processing}
              className="w-full mt-6 px-6 py-3 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
              style={{ backgroundColor: processing ? '#9ca3af' : 'rgb(60,160,117)' }}
              onMouseEnter={(e) => {
                if (!processing) {
                  e.target.style.backgroundColor = 'rgb(34,117,81)';
                }
              }}
              onMouseLeave={(e) => {
                if (!processing) {
                  e.target.style.backgroundColor = 'rgb(60,160,117)';
                }
              }}
            >
              <CheckCircle size={20} />
              Start Enrichment
            </button>
          )}
        </div>

        {/* Progress */}
        {progress && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              {processing ? (
                <Loader2 className="animate-spin" size={24} style={{ color: 'rgb(60,160,117)' }} />
              ) : (
                <CheckCircle style={{ color: 'rgb(60,160,117)' }} size={24} />
              )}
              <p className="text-gray-700 font-medium">{progress}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
            <div className="flex-1">
              <p className="text-red-800 font-medium mb-1">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* API Errors */}
        {apiErrors.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="text-orange-600 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="text-orange-800 font-semibold mb-2">
                  API Errors ({apiErrors.length})
                </h3>
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
                        {apiError.errorCode && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            {apiError.errorCode}
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-800">
                          {apiError.type}
                        </span>
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
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                        View Details
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(apiError.details, null, 2)}
                      </pre>
                    </details>
                  )}
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
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Results</h2>
              <button
                onClick={downloadResults}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                <Download size={20} />
                Download Excel
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