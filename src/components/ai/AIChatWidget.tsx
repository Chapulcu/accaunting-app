import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/error'
import { MessageSquare, X, Send, Bot, User, Loader2, Minimize2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AIChatWidget() {
  const { settings } = useSettings()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sessionId] = useState(() => crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'ai-chatbot',
        {
          body: {
            message,
            session_id: sessionId,
          },
        }
      )

      if (functionError) throw functionError
      return functionData
    },
    onMutate: (message: string) => {
      // Add user message immediately
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: message, timestamp: new Date() },
      ])
      setInput('')
    },
    onSuccess: (data) => {
      // Add assistant response
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message, timestamp: new Date() },
      ])
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
      // Remove the optimistic user message
      setMessages((prev) => prev.slice(0, -1))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sendMutation.isPending) return

    sendMutation.mutate(input)
  }

  if (!settings?.ai_chatbot_enabled) {
    return null
  }

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-40"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed right-6 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col z-50 transition-all ${
            isMinimized
              ? 'bottom-6 w-80 h-16'
              : 'bottom-6 w-96 h-[600px] max-h-[calc(100vh-3rem)]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-pink-500 to-pink-600 rounded-t-lg">
            <div className="flex items-center gap-2 text-white">
              <Bot className="w-5 h-5" />
              <h3 className="font-semibold">AI Asistan</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors text-white"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    <Bot className="w-12 h-12 mx-auto mb-3 text-pink-500" />
                    <p className="text-sm">Merhaba! Size nasıl yardımcı olabilirim?</p>
                    <p className="text-xs mt-2">
                      Faturalarınız, ödemeleriniz veya raporlarınız hakkında soru sorabilirsiniz.
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${message.role === 'user' ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                          {message.timestamp.toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {sendMutation.isPending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-3">
                      <Loader2 className="w-5 h-5 animate-spin text-pink-600 dark:text-pink-400" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-slate-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Mesajınızı yazın..."
                    className="flex-1 input-field text-sm"
                    disabled={sendMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sendMutation.isPending}
                    className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
