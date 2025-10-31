import React, { useState } from 'react';
import { Card, CardBody, CardHeader, CardTitle, Button, Badge, Avatar } from '@/components/atoms';

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

export interface PollCardProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVote?: string;
  onVote?: (optionId: string) => void;
  authorName?: string;
  createdAt?: string;
  expiresAt?: string;
}

export const PollCard: React.FC<PollCardProps> = ({
  question,
  options,
  totalVotes,
  userVote,
  onVote,
  authorName,
  createdAt,
  expiresAt,
}) => {
  const hasVoted = !!userVote;
  const [selectedOption, setSelectedOption] = useState<string | null>(userVote || null);

  const handleVote = (optionId: string) => {
    if (!hasVoted && onVote) {
      setSelectedOption(optionId);
      onVote(optionId);
    }
  };

  return (
    <Card hover bordered>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{question}</CardTitle>
          {authorName && (
            <div className="flex items-center gap-2">
              <Avatar size="sm" className="text-xs" />
              <span className="text-sm text-base-content/60">{authorName}</span>
            </div>
          )}
        </div>
        {expiresAt && (
          <Badge variant="warning" size="xs" className="mt-2">
            Ends {new Date(expiresAt).toLocaleDateString()}
          </Badge>
        )}
      </CardHeader>
      
      <CardBody>
        <div className="space-y-2">
          {options.map((option) => (
            <div key={option.id} className="relative">
              {hasVoted ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{option.text}</span>
                    <span className="text-sm text-base-content/60">
                      {option.votes} votes ({option.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-base-300 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        selectedOption === option.id ? 'bg-primary' : 'bg-base-content/20'
                      }`}
                      style={{ width: `${option.percentage}%` }}
                    ></div>
                  </div>
                  {selectedOption === option.id && (
                    <Badge variant="success" size="xs" className="absolute right-2 top-0">
                      Your vote
                    </Badge>
                  )}
                </div>
              ) : (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => handleVote(option.id)}
                  className="text-left justify-start h-auto py-2"
                >
                  {option.text}
                </Button>
              )}
            </div>
          ))}
          
          <div className="text-xs text-base-content/60 mt-2">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            {createdAt && ` • ${new Date(createdAt).toLocaleDateString()}`}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
