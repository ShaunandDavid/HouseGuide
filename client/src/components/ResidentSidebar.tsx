import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  Calendar,
  Plus,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL } from "@shared/categories";
import { 
  getGoalsByResident, 
  getChoresByResident, 
  getAccomplishmentsByResident,
  getIncidentsByResident, 
  getMeetingsByResident, 
  getFeesByResident,
  getNotesByResident, 
  getFilesByResident, 
  getWeeklyReportsByResident
} from "@/lib/api";
import type { Goal, Chore, Accomplishment, Incident, Meeting, ProgramFee, Note, FileRecord, WeeklyReport } from "@shared/schema";

// Entry types for different data
type SidebarEntry = {
  id: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  type: 'goal' | 'chore' | 'accomplishment' | 'incident' | 'meeting' | 'fee' | 'note' | 'file' | 'weekly-report';
  data: any;
};

interface SidebarFolder {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color?: string;
  queryKey: string;
  fetchFn?: (residentId: string) => Promise<any[]>;
  items?: {
    id: string;
    title: string;
    icon: React.ComponentType<any>;
    path: string;
    color: string;
    queryKey: string;
    fetchFn: (residentId: string) => Promise<any[]>;
  }[];
  path?: string;
}

interface ResidentSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

// Entry detail modal state
type EntryDetail = {
  isOpen: boolean;
  entry: SidebarEntry | null;
};

export default function ResidentSidebar({ isCollapsed, onToggle }: ResidentSidebarProps) {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['trackers']));
  const [entryDetail, setEntryDetail] = useState<EntryDetail>({ isOpen: false, entry: null });

  // Helper function to format entries from API data
  const formatEntries = (data: any[], type: SidebarEntry['type']): SidebarEntry[] => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map((item) => {
      let title = '';
      let subtitle = '';
      let timestamp = item.created || item.updated || new Date().toISOString();
      
      switch (type) {
        case 'goal':
          title = item.title || 'Untitled Goal';
          subtitle = `Status: ${item.status || 'not_started'}`;
          break;
        case 'chore':
          title = item.choreName || 'Untitled Chore';
          subtitle = `Due: ${item.dueDate || 'No due date'}`;
          break;
        case 'accomplishment':
          title = item.title || 'Untitled Accomplishment';
          subtitle = `Category: ${item.category || 'personal'}`;
          break;
        case 'incident':
          title = `${item.incidentType || 'incident'} - ${item.severity || 'medium'}`;
          subtitle = item.description?.substring(0, 50) + (item.description?.length > 50 ? '...' : '') || '';
          break;
        case 'meeting':
          title = `${item.meetingType || 'meeting'} meeting`;
          subtitle = `Date: ${item.dateAttended || 'TBD'}`;
          break;
        case 'fee':
          title = `${item.feeType || 'fee'} - $${item.amount || '0'}`;
          subtitle = `Status: ${item.status || 'pending'}`;
          break;
        case 'note':
          title = item.text?.substring(0, 30) + (item.text?.length > 30 ? '...' : '') || 'Untitled Note';
          subtitle = item.category && item.category !== 'general'
            ? `Category: ${CATEGORY_LABEL[item.category]} | Source: ${item.source || 'manual'}`
            : `Source: ${item.source || 'manual'}`;
          break;
        case 'file':
          title = item.filename || 'Untitled File';
          subtitle = `Type: ${item.type || 'general'}`;
          break;
        case 'weekly-report':
          title = item.title || `Week of ${item.weekStart}`;
          subtitle = `${item.weekStart} - ${item.weekEnd}`;
          break;
        default:
          title = 'Untitled Entry';
      }
      
      return {
        id: item.id,
        title,
        subtitle,
        timestamp,
        type,
        data: item
      };
    });
  };

  const folders: SidebarFolder[] = [
    {
      id: 'weekly-reports',
      title: 'Weekly Reports',
      icon: FileText,
      color: 'blue',
      queryKey: 'weeklyReports',
      fetchFn: (residentId: string) => getWeeklyReportsByResident(residentId),
      path: `/resident/${id}/reports`
    },
    {
      id: 'pictures',
      title: 'Pictures',
      icon: Camera,
      color: 'purple',
      queryKey: 'files',
      fetchFn: (residentId: string) => getFilesByResident(residentId),
      path: `/resident/${id}/pictures`
    },
    {
      id: 'notes',
      title: 'Notes',
      icon: StickyNote,
      color: 'green',
      queryKey: 'notes',
      fetchFn: (residentId: string) => getNotesByResident(residentId),
      path: `/resident/${id}/notes`
    },
    {
      id: 'trackers',
      title: 'Trackers',
      icon: Calendar,
      queryKey: 'trackers',
      items: [
        {
          id: 'goals',
          title: 'Goals',
          icon: Target,
          path: `/resident/${id}/goals`,
          color: 'blue',
          queryKey: 'goals',
          fetchFn: (residentId: string) => getGoalsByResident(residentId)
        },
        {
          id: 'checklist',
          title: 'Checklist',
          icon: CheckSquare,
          path: `/resident/${id}/checklist`,
          color: 'green',
          queryKey: 'checklist',
          fetchFn: () => Promise.resolve([]) // Checklist is singular, handled differently
        },
        {
          id: 'chores',
          title: 'Chores',
          icon: Home,
          path: `/resident/${id}/chores`,
          color: 'purple',
          queryKey: 'chores',
          fetchFn: (residentId: string) => getChoresByResident(residentId)
        },
        {
          id: 'accomplishments',
          title: 'Accomplishments',
          icon: Award,
          path: `/resident/${id}/accomplishments`,
          color: 'yellow',
          queryKey: 'accomplishments',
          fetchFn: (residentId: string) => getAccomplishmentsByResident(residentId)
        },
        {
          id: 'incidents',
          title: 'Incidents',
          icon: AlertTriangle,
          path: `/resident/${id}/incidents`,
          color: 'red',
          queryKey: 'incidents',
          fetchFn: (residentId: string) => getIncidentsByResident(residentId)
        },
        {
          id: 'meetings',
          title: 'Meetings',
          icon: Users,
          path: `/resident/${id}/meetings`,
          color: 'indigo',
          queryKey: 'meetings',
          fetchFn: (residentId: string) => getMeetingsByResident(residentId)
        },
        {
          id: 'fees',
          title: 'Fees',
          icon: DollarSign,
          path: `/resident/${id}/fees`,
          color: 'emerald',
          queryKey: 'fees',
          fetchFn: (residentId: string) => getFeesByResident(residentId)
        }
      ]
    }
  ];

  // React Query hooks for fetching data
  const queryResults = {
    weeklyReports: useQuery({
      queryKey: ['weeklyReports', id],
      queryFn: () => getWeeklyReportsByResident(id || ''),
      enabled: !!id
    }),
    files: useQuery({
      queryKey: ['files', id],
      queryFn: () => getFilesByResident(id || ''),
      enabled: !!id
    }),
    notes: useQuery({
      queryKey: ['notes', id],
      queryFn: () => getNotesByResident(id || ''),
      enabled: !!id
    }),
    goals: useQuery({
      queryKey: ['goals', id],
      queryFn: () => getGoalsByResident(id || ''),
      enabled: !!id
    }),
    chores: useQuery({
      queryKey: ['chores', id],
      queryFn: () => getChoresByResident(id || ''),
      enabled: !!id
    }),
    accomplishments: useQuery({
      queryKey: ['accomplishments', id],
      queryFn: () => getAccomplishmentsByResident(id || ''),
      enabled: !!id
    }),
    incidents: useQuery({
      queryKey: ['incidents', id],
      queryFn: () => getIncidentsByResident(id || ''),
      enabled: !!id
    }),
    meetings: useQuery({
      queryKey: ['meetings', id],
      queryFn: () => getMeetingsByResident(id || ''),
      enabled: !!id
    }),
    fees: useQuery({
      queryKey: ['fees', id],
      queryFn: () => getFeesByResident(id || ''),
      enabled: !!id
    })
  };

  // Get entry count for a folder
  const getEntryCount = (queryKey: string): number => {
    const result = queryResults[queryKey as keyof typeof queryResults];
    return result?.data?.length || 0;
  };

  // Get entries for a folder
  const getEntries = (folder: SidebarFolder): SidebarEntry[] => {
    if (folder.queryKey === 'trackers') return []; // Trackers is a parent folder
    
    const result = queryResults[folder.queryKey as keyof typeof queryResults];
    const data = result?.data || [];
    
    let entryType: SidebarEntry['type'];
    switch (folder.queryKey) {
      case 'weeklyReports': entryType = 'weekly-report'; break;
      case 'files': entryType = 'file'; break;
      case 'notes': entryType = 'note'; break;
      default: entryType = 'note';
    }
    
    return formatEntries(data, entryType);
  };

  // Get entries for tracker items
  const getTrackerEntries = (item: { queryKey: string }): SidebarEntry[] => {
    const result = queryResults[item.queryKey as keyof typeof queryResults];
    const data = result?.data || [];
    return formatEntries(data, item.queryKey as SidebarEntry['type']);
  };

  const toggleFolder = (folderId: string) => {
    const newOpenFolders = new Set(openFolders);
    if (newOpenFolders.has(folderId)) {
      newOpenFolders.delete(folderId);
    } else {
      newOpenFolders.add(folderId);
    }
    setOpenFolders(newOpenFolders);
  };

  const handleEntryClick = (entry: SidebarEntry) => {
    setEntryDetail({ isOpen: true, entry });
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: "text-blue-600 hover:bg-blue-50 border-blue-200",
      green: "text-green-600 hover:bg-green-50 border-green-200",
      purple: "text-purple-600 hover:bg-purple-50 border-purple-200",
      yellow: "text-yellow-600 hover:bg-yellow-50 border-yellow-200",
      red: "text-red-600 hover:bg-red-50 border-red-200",
      indigo: "text-indigo-600 hover:bg-indigo-50 border-indigo-200",
      emerald: "text-emerald-600 hover:bg-emerald-50 border-emerald-200"
    };
    return colorMap[color as keyof typeof colorMap] || "text-gray-600 hover:bg-gray-50 border-gray-200";
  };

  const getBadgeVariant = (color: string): "default" | "secondary" | "destructive" | "outline" => {
    if (color === 'red') return 'destructive';
    return 'outline';
  };

  if (!id) return null;

  return (
    <div 
      className="bg-white border-r border-gray-200 h-full flex flex-col w-64 sm:w-72 lg:w-64"
      data-testid="resident-sidebar"
    >
      {/* Header - Mobile First */}
      <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Navigation</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          data-testid="sidebar-toggle"
          className="lg:hidden"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* Navigation - Mobile First */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {folders.map((folder) => {
            const Icon = folder.icon;
            const isOpen = openFolders.has(folder.id);
            const entryCount = getEntryCount(folder.queryKey);
            const entries = getEntries(folder);

            if (folder.items) {
              // Trackers folder with subitems - Mobile optimized
              return (
                <Collapsible
                  key={folder.id}
                  open={isOpen}
                  onOpenChange={() => toggleFolder(folder.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-700 hover:bg-gray-100 h-10 sm:h-9 touch-manipulation"
                      data-testid={`folder-${folder.id}`}
                    >
                      <Icon className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="flex-1 text-left text-sm sm:text-base">{folder.title}</span>
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4">
                    <div className="space-y-1">
                      {folder.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemCount = getEntryCount(item.queryKey);
                        const trackerEntries = getTrackerEntries(item);
                        const isItemOpen = openFolders.has(item.id);
                        
                        return (
                          <div key={item.id}>
                            <Collapsible
                              open={isItemOpen}
                              onOpenChange={() => toggleFolder(item.id)}
                            >
                              <div className="flex items-center gap-1">
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className={cn(
                                      "flex-1 justify-start text-sm h-9 touch-manipulation",
                                      getColorClasses(item.color)
                                    )}
                                    data-testid={`nav-${item.id}`}
                                  >
                                    <ItemIcon className="w-3 h-3 mr-2" />
                                    <span className="flex-1 text-left">{item.title}</span>
                                    <Badge variant={getBadgeVariant(item.color)} className="mr-1 text-xs px-1.5">
                                      {itemCount}
                                    </Badge>
                                    {isItemOpen ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="p-1.5 h-8 w-8 touch-manipulation"
                                  onClick={() => setLocation(item.path)}
                                  data-testid={`add-${item.id}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                              
                              <CollapsibleContent className="pl-4 mt-1">
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {trackerEntries.length === 0 ? (
                                    <div className="text-xs text-gray-500 py-3 px-3">
                                      No entries yet
                                    </div>
                                  ) : (
                                    trackerEntries.slice(0, 10).map((entry) => (
                                      <div
                                        key={entry.id}
                                        className={cn(
                                          "p-3 rounded text-xs border cursor-pointer transition-colors touch-manipulation",
                                          getColorClasses(item.color)
                                        )}
                                        onClick={() => handleEntryClick(entry)}
                                        data-testid={`entry-${entry.id}`}
                                      >
                                        <div className="font-medium truncate">{entry.title}</div>
                                        {entry.subtitle && (
                                          <div className="text-gray-500 truncate mt-1">{entry.subtitle}</div>
                                        )}
                                        <div className="text-gray-400 mt-2">
                                          {formatTimestamp(entry.timestamp)}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                  {trackerEntries.length > 10 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full text-xs h-8 touch-manipulation"
                                      onClick={() => setLocation(item.path)}
                                    >
                                      View all {trackerEntries.length} items
                                    </Button>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            } else {
              // Simple folder with entries - Mobile optimized
              return (
                <Collapsible
                  key={folder.id}
                  open={isOpen}
                  onOpenChange={() => toggleFolder(folder.id)}
                >
                  <div className="flex items-center gap-1">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex-1 justify-start text-gray-700 hover:bg-gray-100 h-10 sm:h-9 touch-manipulation"
                        data-testid={`folder-${folder.id}`}
                      >
                        <Icon className="w-4 h-4 mr-3 flex-shrink-0" />
                        <span className="flex-1 text-left text-sm sm:text-base">{folder.title}</span>
                        <Badge variant="outline" className="mr-1 text-xs px-1.5">
                          {entryCount}
                        </Badge>
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 h-8 w-8 touch-manipulation"
                      onClick={() => folder.path && setLocation(folder.path)}
                      data-testid={`add-${folder.id}`}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  <CollapsibleContent className="pl-6 mt-1">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {entries.length === 0 ? (
                        <div className="text-xs text-gray-500 py-3 px-3">
                          No entries yet
                        </div>
                      ) : (
                        entries.slice(0, 10).map((entry) => {
                          const colorClass = folder.color ? getColorClasses(folder.color) : "text-gray-600 hover:bg-gray-50 border-gray-200";
                          return (
                            <div
                              key={entry.id}
                              className={cn(
                                "p-3 rounded text-xs border cursor-pointer transition-colors touch-manipulation",
                                colorClass
                              )}
                              onClick={() => handleEntryClick(entry)}
                              data-testid={`entry-${entry.id}`}
                            >
                              <div className="font-medium truncate">{entry.title}</div>
                              {entry.subtitle && (
                                <div className="text-gray-500 truncate mt-1">{entry.subtitle}</div>
                              )}
                              <div className="text-gray-400 mt-2">
                                {formatTimestamp(entry.timestamp)}
                              </div>
                            </div>
                          );
                        })
                      )}
                      {entries.length > 10 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs h-8 touch-manipulation"
                          onClick={() => folder.path && setLocation(folder.path)}
                        >
                          View all {entries.length} items
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            }
          })}
        </div>
      </ScrollArea>
      
      {/* Entry Detail Modal - Simple overlay for now */}
      {entryDetail.isOpen && entryDetail.entry && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setEntryDetail({ isOpen: false, entry: null })}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">{entryDetail.entry.title}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEntryDetail({ isOpen: false, entry: null })}
                className="p-1"
              >
                ×
              </Button>
            </div>
            
            {entryDetail.entry.subtitle && (
              <p className="text-gray-600 mb-3">{entryDetail.entry.subtitle}</p>
            )}
            
            <div className="text-sm text-gray-500 mb-4">
              Created: {formatTimestamp(entryDetail.entry.timestamp)}
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              {entryDetail.entry.data.text && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Note Content:</h4>
                  <p className="text-gray-700 whitespace-pre-wrap break-words">
                    {entryDetail.entry.data.text}
                  </p>
                </div>
              )}
              
              {entryDetail.entry.data.source && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Source:</h4>
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                    entryDetail.entry.data.source === 'manual' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {entryDetail.entry.data.source === 'manual' ? 'Manual Entry' : 'OCR Extracted'}
                  </span>
                </div>
              )}

              {entryDetail.entry.data.category && entryDetail.entry.data.category !== 'general' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Category:</h4>
                  <span className="inline-flex px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                    {CATEGORY_LABEL[entryDetail.entry.data.category] || entryDetail.entry.data.category}
                  </span>
                </div>
              )}
              
              {entryDetail.entry.data.createdBy && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Created by:</h4>
                  <p className="text-gray-600 text-sm">{entryDetail.entry.data.createdBy}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
