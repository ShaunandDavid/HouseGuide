import { FileText, AlertTriangle, Camera, File } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FileRecord } from "@shared/schema";
// Helper function to get file URL
const getFileUrl = (file: FileRecord) => {
  const rawUrl = file.url || "";
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  if (rawUrl.startsWith("/")) {
    return rawUrl;
  }
  return `/${rawUrl}`;
};

interface FileCardProps {
  file: FileRecord;
  onViewFile?: (file: FileRecord) => void;
}

export function FileCard({ file, onViewFile }: FileCardProps) {
  // Get proper icon and styling based on file type
  const getFileTypeInfo = (type: string) => {
    switch (type) {
      case 'commitment':
        return {
          icon: FileText,
          bgColor: 'bg-green-100',
          textColor: 'text-green-600',
          badgeBg: 'bg-green-100',
          badgeText: 'text-green-800',
          label: 'Commitment'
        };
      case 'writeup':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-600',
          badgeBg: 'bg-amber-100',
          badgeText: 'text-amber-800',
          label: 'Write-up'
        };
      case 'incident':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
          badgeBg: 'bg-red-100',
          badgeText: 'text-red-800',
          label: 'Incident'
        };
      case 'photo':
        return {
          icon: Camera,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-600',
          badgeBg: 'bg-blue-100',
          badgeText: 'text-blue-800',
          label: 'Photo'
        };
      default: // 'general' or any other type
        return {
          icon: File,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
          badgeBg: 'bg-gray-100',
          badgeText: 'text-gray-800',
          label: 'General'
        };
    }
  };

  const typeInfo = getFileTypeInfo(file.type || 'general');
  const Icon = typeInfo.icon;
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return `${diffDays} days ago`;
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`file-card-${file.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeInfo.bgColor}`}>
            <Icon className={`w-5 h-5 ${typeInfo.textColor}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <Badge 
                variant="secondary"
                className={`${typeInfo.badgeBg} ${typeInfo.badgeText}`}
                data-testid={`badge-${file.type}`}
              >
                {typeInfo.label}
              </Badge>
              <span className="text-sm text-muted-foreground" data-testid="file-date">
                {formatDate(file.created)}
              </span>
            </div>
            
            {file.ocrText && (
              <p className="text-sm text-foreground mb-2" data-testid="ocr-text">
                "{truncateText(file.ocrText)}"
              </p>
            )}
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewFile?.(file)}
                data-testid="view-file-button"
              >
                View Full
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(getFileUrl(file), '_blank')}
                data-testid="view-image-button"
              >
                View Image
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
