import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { aiAPI, creditsAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
} from '../../components/ui';
import {
  MessageSquare,
  Send,
  Coins,
  Sparkles,
  User,
  Bot,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "How can I increase my sales this month?",
  "Which products should I restock?",
  "Analyze my top-selling products",
  "Give me marketing ideas for the weekend",
  "How can I reduce my expenses?",
  "What's my best-performing category?",
];

const AIChat = () => {
  const { currentStore, updateCredits } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: creditsData, refetch: refetchCredits } = useQuery({
    queryKey: ['credits-balance'],
    queryFn: () => creditsAPI.getBalance(),
  });

  const credits = creditsData?.data?.data?.credits ?? currentStore?.credits ?? 0;

  const chatMutation = useMutation({
    mutationFn: (message: string) => aiAPI.chat({ message }),
    onSuccess: (response) => {
      const data = response.data?.data;
      if (data?.response) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
          },
        ]);
      }
      if (data?.remainingCredits !== undefined) {
        updateCredits(data.remainingCredits);
        refetchCredits();
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (message?: string) => {
    const text = message || input.trim();
    if (!text || credits < 4) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      },
    ]);
    setInput('');
    chatMutation.mutate(text);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            AI Chat Assistant
          </h1>
          <p className="text-muted-foreground">
            Chat with AI about your business
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
            <Coins className="w-5 h-5 text-primary" />
            <span className="font-semibold">{credits} credits</span>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearChat}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <Card className="flex flex-col h-[calc(100%-5rem)]">
        <CardHeader className="border-b py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <span className="font-medium">GrowthPilot AI</span>
              <Badge variant="outline" className="text-xs">GPT-4</Badge>
            </div>
            <Badge>4 credits per message</Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                How can I help you today?
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Ask me anything about your business - sales analysis, inventory tips,
                marketing ideas, or growth strategies.
              </p>

              {/* Suggested Prompts */}
              <div className="grid gap-2 max-w-lg">
                {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    disabled={credits < 4 || chatMutation.isPending}
                    className="text-left p-3 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <p className="text-sm">{prompt}</p>
                  </button>
                ))}
              </div>

              {credits < 4 && (
                <div className="mt-6 p-4 bg-destructive/10 rounded-lg">
                  <p className="text-sm text-destructive mb-2">
                    Insufficient credits to chat
                  </p>
                  <Link to="/credits">
                    <Button size="sm">Buy Credits</Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' && 'flex-row-reverse'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                      message.role === 'user'
                        ? 'bg-primary'
                        : 'bg-primary/10'
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-primary-foreground" />
                    ) : (
                      <Bot className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg p-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    <p
                      className={cn(
                        'text-xs mt-1',
                        message.role === 'user'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                credits < 4
                  ? 'Insufficient credits...'
                  : 'Ask anything about your business...'
              }
              disabled={credits < 4 || chatMutation.isPending}
              className="flex-1"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || credits < 4 || chatMutation.isPending}
              isLoading={chatMutation.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AIChat;
