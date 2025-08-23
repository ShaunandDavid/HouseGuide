import { FileText, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FileRecord } from "@shared/schema";
import { getFileUrl } from "@/lib/pocketbase";

interface FileCardProps {
  file: FileRecord;
  onViewFile?: (file: FileRecord) => void;
}

export function FileCard({ file, onViewFile }: FileCardProps) {
  const isCommitment = file.type === 'commitment';
  const Icon = isCommitment ? FileText : AlertTriangle;
  
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
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isCommitment ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            <Icon className={`w-5 h-5 ${
              isCommitment ? 'text-green-600' : 'text-amber-600'
            }`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <Badge 
                variant="secondary"
                className={isCommitment ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                data-testid={`badge-${file.type}`}
              >
                {isCommitment ? 'Commitment' : 'Write-up'}
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
