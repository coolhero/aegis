// F012 T008: API Explorer panel
'use client';

import { useState } from 'react';
import { API_CATALOG, getCategories, getEndpointsByCategory, ApiEndpoint } from '@/lib/api-catalog';
import { apiClient } from '@/lib/api-client';

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-purple-100 text-purple-800',
};

export function ApiExplorerPanel() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const categories = getCategories();

  function handleSelect(endpoint: ApiEndpoint) {
    setSelectedEndpoint(endpoint);
    setParamValues({});
    setRequestBody(endpoint.requestBody ? JSON.stringify(endpoint.requestBody, null, 2) : '');
    setResponse(null);
  }

  async function handleTryIt() {
    if (!selectedEndpoint) return;

    setIsLoading(true);
    setResponse(null);

    let path = selectedEndpoint.path;
    // Replace path params
    for (const [key, value] of Object.entries(paramValues)) {
      path = path.replace(`:${key}`, value);
    }

    try {
      const config: any = { url: path, method: selectedEndpoint.method.toLowerCase() };
      if (requestBody && ['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method)) {
        config.data = JSON.parse(requestBody);
      }

      const res = await apiClient.request(config);
      setResponse({
        status: res.status,
        body: JSON.stringify(res.data, null, 2),
      });
    } catch (error: any) {
      const status = error?.response?.status || 0;
      const body = error?.response?.data
        ? JSON.stringify(error.response.data, null, 2)
        : error?.message || 'Request failed';
      setResponse({ status, body });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Endpoint List */}
      <div className="w-80 flex-shrink-0 bg-white rounded-lg border overflow-y-auto">
        <div className="p-3 border-b font-medium text-gray-700">API Endpoints</div>
        {categories.map((cat) => (
          <div key={cat}>
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">{cat}</div>
            {getEndpointsByCategory(cat).map((ep, i) => (
              <button
                key={i}
                onClick={() => handleSelect(ep)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b transition-colors ${
                  selectedEndpoint === ep ? 'bg-blue-50' : ''
                }`}
              >
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono mr-2 ${METHOD_COLORS[ep.method]}`}>
                  {ep.method}
                </span>
                <span className="text-gray-700 font-mono text-xs">{ep.path}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Detail Panel */}
      <div className="flex-1 bg-white rounded-lg border p-4 overflow-y-auto">
        {!selectedEndpoint ? (
          <p className="text-gray-400 text-center mt-8">Select an endpoint</p>
        ) : (
          <div className="space-y-4">
            <div>
              <span className={`inline-block px-2 py-1 rounded text-sm font-mono mr-2 ${METHOD_COLORS[selectedEndpoint.method]}`}>
                {selectedEndpoint.method}
              </span>
              <span className="font-mono text-gray-800">{selectedEndpoint.path}</span>
            </div>
            <p className="text-sm text-gray-600">{selectedEndpoint.description}</p>

            {/* Path Params */}
            {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Parameters</div>
                {selectedEndpoint.params.map((p) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-24">{p.name}</label>
                    <input
                      type="text"
                      value={paramValues[p.name] || ''}
                      onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                      placeholder={p.description}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Request Body */}
            {['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Request Body</div>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono resize-none"
                />
              </div>
            )}

            <button
              onClick={handleTryIt}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Try it'}
            </button>

            {/* Response */}
            {response && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700">Response</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    response.status >= 200 && response.status < 300
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {response.status || 'Error'}
                  </span>
                </div>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto max-h-[300px] overflow-y-auto">
                  {response.body}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
