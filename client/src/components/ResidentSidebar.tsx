import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { 
  ChevronDown, 
  ChevronRight,
  FileText,
  Camera,
  StickyNote,
  Target,
  CheckSquare,
  Home,
  Award,
  AlertTriangle,
  Users,
  DollarSign,
  PanelLeft,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SidebarFolder {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  items?: {
    id: string;
    title: string;
    icon: React.ComponentType<any>;
    path: string;
    color: string;
  }[];
  path?: string;
}

interface ResidentSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function ResidentSidebar({ isCollapsed, onToggle }: ResidentSidebarProps) {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['trackers']));

  const folders: SidebarFolder[] = [
    {
      id: 'weekly-reports',
      title: 'Weekly Reports',
      icon: FileText,
      path: `/resident/${id}/reports`
    },
    {
      id: 'pictures',
      title: 'Pictures',
      icon: Camera,
      path: `/resident/${id}/pictures`
    },
    {
      id: 'notes',
      title: 'Notes',
      icon: StickyNote,
      path: `/resident/${id}/notes`
    },
    {
      id: 'trackers',
      title: 'Trackers',
      icon: Calendar,
      items: [
        {
          id: 'goals',
          title: 'Goals',
          icon: Target,
          path: `/resident/${id}/goals`,
          color: 'blue'
        },
        {
          id: 'checklist',
          title: 'Checklist',
          icon: CheckSquare,
          path: `/resident/${id}/checklist`,
          color: 'green'
        },
        {
          id: 'chores',
          title: 'Chores',
          icon: Home,
          path: `/resident/${id}/chores`,
          color: 'purple'
        },
        {
          id: 'accomplishments',
          title: 'Accomplishments',
          icon: Award,
          path: `/resident/${id}/accomplishments`,
          color: 'yellow'
        },
        {
          id: 'incidents',
          title: 'Incidents',
          icon: AlertTriangle,
          path: `/resident/${id}/incidents`,
          color: 'red'
        },
        {
          id: 'meetings',
          title: 'Meetings',
          icon: Users,
          path: `/resident/${id}/meetings`,
          color: 'indigo'
        },
        {
          id: 'fees',
          title: 'Fees',
          icon: DollarSign,
          path: `/resident/${id}/fees`,
          color: 'emerald'
        }
      ]
    }
  ];

  const toggleFolder = (folderId: string) => {
    const newOpenFolders = new Set(openFolders);
    if (newOpenFolders.has(folderId)) {
      newOpenFolders.delete(folderId);
    } else {
      newOpenFolders.add(folderId);
    }
    setOpenFolders(newOpenFolders);
  };

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: "text-blue-600 hover:bg-blue-50",
      green: "text-green-600 hover:bg-green-50",
      purple: "text-purple-600 hover:bg-purple-50",
      yellow: "text-yellow-600 hover:bg-yellow-50",
      red: "text-red-600 hover:bg-red-50",
      indigo: "text-indigo-600 hover:bg-indigo-50",
      emerald: "text-emerald-600 hover:bg-emerald-50"
    };
    return colorMap[color as keyof typeof colorMap] || "text-gray-600 hover:bg-gray-50";
  };

  return (
    <div 
      className={cn(
        "bg-white border-r border-gray-200 h-full flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
      data-testid="resident-sidebar"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!isCollapsed && (
          <h3 className="font-semibold text-gray-900">Navigation</h3>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          data-testid="sidebar-toggle"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {folders.map((folder) => {
            const Icon = folder.icon;
            const isOpen = openFolders.has(folder.id);

            if (folder.items) {
              // Folder with subitems
              return (
                <Collapsible
                  key={folder.id}
                  open={isOpen}
                  onOpenChange={() => toggleFolder(folder.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-gray-700 hover:bg-gray-100",
                        isCollapsed && "px-2"
                      )}
                      data-testid={`folder-${folder.id}`}
                    >
                      <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left">{folder.title}</span>
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className={cn("pl-6", isCollapsed && "hidden")}>
                    <div className="space-y-1">
                      {folder.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Button
                            key={item.id}
                            variant="ghost"
                            className={cn(
                              "w-full justify-start text-sm",
                              getColorClasses(item.color)
                            )}
                            onClick={() => setLocation(item.path)}
                            data-testid={`nav-${item.id}`}
                          >
                            <ItemIcon className="w-3 h-3 mr-2" />
                            {item.title}
                          </Button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            } else {
              // Simple folder
              return (
                <Button
                  key={folder.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-gray-700 hover:bg-gray-100",
                    isCollapsed && "px-2"
                  )}
                  onClick={() => folder.path && setLocation(folder.path)}
                  data-testid={`nav-${folder.id}`}
                >
                  <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                  {!isCollapsed && folder.title}
                </Button>
              );
            }
          })}
        </div>
      </ScrollArea>
    </div>
  );
}