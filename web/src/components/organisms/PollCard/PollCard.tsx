'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, _CardDescription } from '@/components/ui/shadcn/card';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/atoms/Badge/Badge';
import { Avatar, _AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User } from 'lucide-react';

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
    <Card className="rounded-xl border hover:shadow-md transition-shadow duration-200">
      <CardHeader className="mb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{question}</CardTitle>
          {authorName && (
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 text-xs">
                <AvatarFallback className="bg-secondary/10 text-secondary-foreground font-medium uppercase">
                  <User size={14} />
                </AvatarFallback>
              </Avatar>
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

      <CardContent className="p-6 pt-0">
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
                      className={`h-2 rounded-full transition-all duration-300 ${selectedOption === option.id ? 'bg-primary' : 'bg-base-content/20'
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
                  className="rounded-xl active:scale-[0.98] w-full text-left justify-start h-auto py-2"
                  onClick={() => handleVote(option.id)}
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
      </CardContent>
    </Card>
  );
};