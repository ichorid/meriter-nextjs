'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { Users, Star } from 'lucide-react';

export interface FutureVisionItem {
  communityId: string;
  name: string;
  description?: string;
  futureVisionText?: string;
  futureVisionTags?: string[];
  futureVisionCover?: string;
  publicationId: string;
  score: number;
  memberCount: number;
}

export interface FutureVisionCardProps {
  item: FutureVisionItem;
}

export function FutureVisionCard({ item }: FutureVisionCardProps) {
  const t = useTranslations('common');
  return (
    <Card className="h-full transition-shadow hover:shadow-md overflow-hidden">
      <Link href={`/meriter/communities/${item.communityId}`} className="block">
        {item.futureVisionCover && (
          <div className="aspect-video w-full bg-muted relative overflow-hidden">
            <img
              src={item.futureVisionCover}
              alt=""
              className="object-cover w-full h-full"
            />
          </div>
        )}
        <CardHeader className="pb-2">
          <h3 className="font-semibold line-clamp-2">{item.name}</h3>
          {item.futureVisionText && (
            <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
              {item.futureVisionText}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex flex-wrap gap-1">
            {item.futureVisionTags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {item.memberCount}
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              {item.score}
            </span>
          </div>
        </CardContent>
      </Link>
      <CardContent className="pt-0 border-t">
        <Button asChild variant="default" className="w-full">
          <Link href={`/meriter/communities/${item.communityId}`}>
            {t('join')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
