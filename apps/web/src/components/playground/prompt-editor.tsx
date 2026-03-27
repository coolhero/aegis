// F012 T005: Prompt editor — F010 template integration
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  variables: { name: string; description?: string }[];
}

interface PromptEditorProps {
  onSendPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function PromptEditor({ onSendPrompt, disabled }: PromptEditorProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [renderedPrompt, setRenderedPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { data } = await apiClient.get('/prompts');
      const list = Array.isArray(data) ? data : data?.items || [];
      setTemplates(list);
    } catch {
      // F010 may not be available — show empty list
      setTemplates([]);
    }
  }

  function handleTemplateSelect(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    setSelectedTemplate(template || null);
    setVariables({});
    setRenderedPrompt('');
  }

  function handleVariableChange(name: string, value: string) {
    setVariables((prev) => ({ ...prev, [name]: value }));
  }

  async function handlePreview() {
    if (!selectedTemplate) return;
    setIsLoading(true);
    try {
      const { data } = await apiClient.post(`/prompts/${selectedTemplate.id}/resolve`, {
        variables,
      });
      setRenderedPrompt(data.content || data.rendered || JSON.stringify(data));
    } catch {
      setRenderedPrompt('[Preview failed — check template variables]');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border">
      <div className="font-medium text-gray-700">Prompt Editor</div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Template</label>
        <select
          value={selectedTemplate?.id || ''}
          onChange={(e) => handleTemplateSelect(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select a template...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">Variables</div>
          {selectedTemplate.variables.map((v) => (
            <div key={v.name}>
              <label className="block text-xs text-gray-500 mb-0.5">
                {v.name} {v.description && `— ${v.description}`}
              </label>
              <input
                type="text"
                value={variables[v.name] || ''}
                onChange={(e) => handleVariableChange(v.name, e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                placeholder={v.name}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={!selectedTemplate || isLoading}
          className="px-3 py-1.5 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
        >
          Preview
        </button>
        <button
          onClick={() => renderedPrompt && onSendPrompt(renderedPrompt)}
          disabled={!renderedPrompt || disabled}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>

      {renderedPrompt && (
        <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-800 whitespace-pre-wrap border">
          {renderedPrompt}
        </div>
      )}
    </div>
  );
}
