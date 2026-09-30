import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Eye,
  EyeOff,
  User,
  Shield,
  Download,
  Image,
  FileText,
  MessageSquare,
} from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { ATTACHMENT_ACCEPT, validateAttachments } from '../../utils/attachments';
import { toast } from 'react-toastify';

const ChatInterface = ({
  messages = [],
  currentUser,
  onSendMessage,
  onSendInternalNote,
  onFileUpload,
  isReporter = false,
  showInternalToggle = true,
  isLoading = false,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [file, setFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() && !file) return;

    if (isInternal && onSendInternalNote) {
      onSendInternalNote(newMessage);
    } else if (onSendMessage) {
      const messageData = {
        content: newMessage,
        file: file,
      };
      onSendMessage(messageData);
    }

    setNewMessage('');
    setFile(null);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const { valid, errors } = validateAttachments([selectedFile], 0);
    if (valid.length === 0) {
      toast.error(errors[0]);
      e.target.value = '';
      return;
    }
    setFile(valid[0]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredMessages = showInternal
    ? messages
    : messages.filter(msg => !msg.is_internal);

  const getMessageAlignment = (message) => {
    if (message.is_internal) return 'center';
    if (message.sender_id === currentUser?.id) return 'right';
    return 'left';
  };

  const getMessageClasses = (message) => {
    const alignment = getMessageAlignment(message);

    if (message.is_internal) {
      return 'bg-warning-soft border-warning-line';
    }

    if (alignment === 'right') {
      return 'bg-accent-soft border-line-accent ml-auto';
    }

    return 'bg-subtle border-line';
  };

  const renderMessage = (message) => {
    const alignment = getMessageAlignment(message);
    const isCurrentUser = message.sender_id === currentUser?.id;
    const isInternal = message.is_internal;

    return (
      <div
        key={message.id}
        className={`mb-4 ${alignment === 'right' ? 'flex justify-end' : ''}`}
      >
        <div
          className={`max-w-2xl rounded-lg border p-4 ${getMessageClasses(message)}`}
        >
          {/* Message Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              {isInternal ? (
                <>
                  <Shield className="w-4 h-4 text-warning-fg mr-2" />
                  <span className="text-sm font-medium text-warning-fg">
                    Internal Note
                  </span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-ink-muted mr-2" />
                  <span className="text-sm font-medium text-ink">
                    {message.sender?.full_name || message.sender?.name || message.sender?.username || 'Unknown'}
                    {isCurrentUser && ' (You)'}
                  </span>
                </>
              )}
            </div>
            <span className="text-xs text-ink-muted">
              {formatDateTime(message.created_at || (message.timestamp ? message.timestamp * 1000 : null))}
            </span>
          </div>

          {/* Message Content */}
          <div className="mb-3">
            <p className="text-ink whitespace-pre-wrap wrap-break-word">
              {message.content}
            </p>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line">
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((attachment, index) => (
                  <a
                    key={index}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-3 py-2 bg-surface border border-line-strong rounded-lg hover:bg-subtle transition-colors"
                  >
                    {attachment.type?.startsWith('image/') ? (
                      <Image className="w-4 h-4 text-ink-muted" />
                    ) : (
                      <FileText className="w-4 h-4 text-ink-muted" />
                    )}
                    <span className="text-sm text-ink-secondary">
                      {attachment.name}
                    </span>
                    <Download className="w-3 h-3 text-ink-subtle" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          {message.read && (
            <div className="text-xs text-ink-muted mt-2">
              <span className="flex items-center">
                <Eye className="w-3 h-3 mr-1" />
                Read
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="text-center py-12">
      <div className="mx-auto w-12 h-12 rounded-full bg-active flex items-center justify-center mb-4">
        <MessageSquare className="w-6 h-6 text-ink-subtle" />
      </div>
      <h3 className="text-lg font-semibold text-ink mb-2">
        No Messages Yet
      </h3>
      <p className="text-ink-muted max-w-md mx-auto">
        {isReporter
          ? 'Send a message to the compliance team to provide additional information or ask questions about your report.'
          : 'Start a conversation with the reporter or add internal notes for your team.'}
      </p>
    </div>
  );

  return (
    <Card className="flex flex-col max-h-150">
      {/* Header */}
      <div className="border-b border-line pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              Communication
            </h3>
            <p className="text-sm text-ink-muted">
              {filteredMessages.length} messages
            </p>
          </div>

          {showInternalToggle && !isReporter && (
            <Button
              variant="ghost"
              size="small"
              onClick={() => setShowInternal(!showInternal)}
              startIcon={showInternal ? EyeOff : Eye}
            >
              {showInternal ? 'Hide Internal' : 'Show Internal'}
            </Button>
          )}
        </div>

        {!isReporter && (
          <div className="mt-3 flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
              />
              <span className="ml-2 text-sm text-ink-secondary">
                Send as internal note
              </span>
            </label>

            {isInternal && (
              <div className="flex items-center text-sm text-warning-fg">
                <Shield className="w-4 h-4 mr-1" />
                Only visible to compliance team
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-4 pr-2 min-h-50">
        {filteredMessages.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-4">
            {filteredMessages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-line pt-4">
        {/* File Preview */}
        {file && (
          <div className="mb-3 p-3 bg-subtle rounded-lg border border-line">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-ink-muted mr-3" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {file.name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="small"
                onClick={() => setFile(null)}
              >
                Remove
              </Button>
            </div>
          </div>
        )}

        {/* Input Form */}
        <div className="flex space-x-2">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                isInternal
                  ? 'Add an internal note...'
                  : isReporter
                    ? 'Type your message to the compliance team...'
                    : 'Type your message...'
              }
              rows={3}
              className="w-full border border-line-strong rounded-lg px-3 py-2 focus:ring-accent-ring focus:border-line-accent resize-none"
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept={ATTACHMENT_ACCEPT}
            />

            {/* <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </Button> */}

            <Button
              variant="secondary"
              size="icon"
              onClick={handleSend}
              disabled={isLoading || (!newMessage.trim() && !file)}
              isLoading={isLoading}
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Helper Text */}
        <div className="mt-2 text-xs text-ink-muted">
          {isInternal ? (
            <div className="flex items-center">
              <Shield className="w-3 h-3 mr-1 text-warning-fg" />
              Internal notes are only visible to the compliance team
            </div>
          ) : isReporter ? (
            'Your messages are confidential and will only be seen by the compliance team'
          ) : (
            'Press Enter to send, Shift+Enter for new line'
          )}
        </div>
      </div>
    </Card>
  );
};

export default ChatInterface;
