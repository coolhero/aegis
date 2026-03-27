// F012 T003: Chat panel — prompt input + streaming response
'use client';

import { useState, useRef, useEffect } from 'react';
import { PlaygroundMessage, PlaygroundParams } from '@/hooks/use-playground';
import { useStreaming } from '@/hooks/use-streaming';

interface ChatPanelProps {
  model: string;
  params: PlaygroundParams;
  messages: PlaygroundMessage[];
  onAddMessage: (msg: PlaygroundMessage) => void;
  onSetMessages: (msgs: PlaygroundMessage[]) => void;
  isStreaming: boolean;
  onStreamingChange: (streaming: boolean) => void;
  onComplete: (usage: { prompt_tokens: number; completion_tokens: number; responseTimeMs: number }) => void;
}

export function ChatPanel({
  model,
  params,
  messages,
  onAddMessage,
  onSetMessages,
  isStreaming: externalStreaming,
  onStreamingChange,
  onComplete,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { send, stop, isStreaming } = useStreaming();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    onStreamingChange(isStreaming);
  }, [isStreaming, onStreamingChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    setError(null);
    const userMsg: PlaygroundMessage = { role: 'user', content: input.trim(), timestamp: new Date() };
    onAddMessage(userMsg);

    const assistantMsg: PlaygroundMessage = { role: 'assistant', content: '', timestamp: new Date() };
    onAddMessage(assistantMsg);

    const allMessages = [...messages, userMsg];
    setInput('');
    startTimeRef.current = Date.now();

    await send({
      model,
      messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      onToken: (token) => {
        onSetMessages((prev: PlaygroundMessage[]) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + token };
          }
          return updated;
        });
      },
      onComplete: (usage) => {
        const responseTimeMs = Date.now() - startTimeRef.current;
        onComplete({ ...usage, responseTimeMs });
      },
      onError: (errMsg) => {
        setError(errMsg);
        // Remove the empty assistant message
        onSetMessages((prev: PlaygroundMessage[]) => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.role === 'assistant' && !updated[updated.length - 1].content) {
            updated.pop();
          }
          return updated;
        });
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center mt-8">Enter a prompt to start</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content || (isStreaming ? '...' : '')}
            </div>
          </div>
        ))}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt..."
            rows={2}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isStreaming}
          />
          <div className="flex flex-col gap-1">
            {isStreaming ? (
              <button
                onClick={stop}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
