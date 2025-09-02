import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, Clock, Activity, TrendingUp, Shield } from 'lucide-react';

interface DrillResult {
  drillType: string;
  timestamp: string;
  success: boolean;
  detectedIn: number;
  recoveredIn: number;
  proceduresFollowed: string[];
  issues: string[];
  improvements: string[];
}

interface DrillAnalytics {
  totalDrills: number;
  recentDrills: number;
  successRate: number;
  averageDetectionTime: number;
  averageRecoveryTime: number;
  drillTypesCovered: string[];
  lastDrill: string;
}

export default function AdminDrillDashboard() {
  const [activeDrill, setActiveDrill] = useState<string | null>(null);
  const [isRunningDrill, setIsRunningDrill] = useState(false);
  const [drillHistory, setDrillHistory] = useState<DrillResult[]>([]);
  const [analytics, setAnalytics] = useState<DrillAnalytics | null>(null);
  const [lastResult, setLastResult] = useState<DrillResult | null>(null);
  const { toast } = useToast();

  // Fetch drill status and history
  const fetchDrillData = async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch('/api/admin/drill/status'),
        fetch('/api/admin/drill/history')
      ]);

      if (statusRes.ok) {
        const status = await statusRes.json();
        setActiveDrill(status.activeDrill);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setDrillHistory(data.history || []);
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch drill data:', error);
    }
  };

  useEffect(() => {
    fetchDrillData();
    const interval = setInterval(fetchDrillData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const runDrill = async (drillType: string) => {
    if (isRunningDrill || activeDrill) return;

    setIsRunningDrill(true);
    
    try {
      const response = await fetch('/api/admin/drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drillType })
      });

      if (response.ok) {
        const result = await response.json();
        setLastResult(result);
        
        toast({
          title: result.success ? "Drill Completed Successfully" : "Drill Had Issues",
          description: `${result.drillType} - Detection: ${result.detectedIn}ms, Recovery: ${result.recoveredIn}ms`,
          variant: result.success ? "default" : "destructive"
        });
        
        // Refresh data after drill
        setTimeout(fetchDrillData, 1000);
      } else {
        const error = await response.json();
        toast({
          title: "Drill Failed",
          description: error.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Drill Error",
        description: "Failed to execute drill",
        variant: "destructive"
      });
    } finally {
      setIsRunningDrill(false);
    }
  };

  const abortDrill = async () => {
    try {
      await fetch('/api/admin/drill/abort', { method: 'POST' });
      setActiveDrill(null);
      toast({
        title: "Drill Aborted",
        description: "Emergency abort completed",
        variant: "destructive"
      });
    } catch (error) {
      toast({
        title: "Abort Failed",
        description: "Manual intervention required",
        variant: "destructive"
      });
    }
  };

  const drillTypes = [
    { key: 'database', name: 'Database Connection', icon: '🗄️', risk: 'critical' },
    { key: 'auth', name: 'Authentication System', icon: '🔐', risk: 'high' },
    { key: 'ai', name: 'AI Classification', icon: '🤖', risk: 'medium' },
    { key: 'backup', name: 'Backup Verification', icon: '💾', risk: 'high' },
    { key: 'complete', name: 'Complete System Outage', icon: '🚨', risk: 'critical' }
  ];

  const getSuccessRate = () => {
    if (!analytics || analytics.recentDrills === 0) return 0;
    return analytics.successRate;
  };

  const getPerformanceColor = (time: number, type: 'detection' | 'recovery') => {
    const thresholds = type === 'detection' ? [500, 1000] : [1000, 2000];
    if (time <= thresholds[0]) return 'text-green-600';
    if (time <= thresholds[1]) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Emergency Drill Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Business Continuity Planning & SOC-2 Compliance Testing
          </p>
        </div>
        
        {activeDrill && (
          <Button 
            onClick={abortDrill} 
            variant="destructive" 
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            EMERGENCY ABORT
          </Button>
        )}
      </div>

      {/* Active Drill Alert */}
      {activeDrill && (
        <Alert className="border-orange-200 bg-orange-50">
          <Activity className="h-4 w-4" />
          <AlertDescription className="font-medium">
            <strong>ACTIVE DRILL:</strong> {activeDrill.replace('_', ' ').toUpperCase()} 
            - System resilience testing in progress
          </AlertDescription>
        </Alert>
      )}

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">{getSuccessRate()}%</div>
              <Progress value={getSuccessRate()} className="flex-1" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {analytics?.recentDrills || 0} recent drills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(analytics?.averageDetectionTime || 0, 'detection')}`}>
              {analytics?.averageDetectionTime || 0}ms
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Target: &lt;500ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Recovery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(analytics?.averageRecoveryTime || 0, 'recovery')}`}>
              {analytics?.averageRecoveryTime || 0}ms
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Target: &lt;1000ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Drills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalDrills || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              Last: {analytics?.lastDrill ? new Date(analytics.lastDrill).toLocaleDateString() : 'Never'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Drill Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Execute Emergency Drills
          </CardTitle>
          <CardDescription>
            Test system resilience and recovery procedures
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {drillTypes.map((drill) => (
              <div key={drill.key} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{drill.icon}</span>
                  <Badge 
                    variant={drill.risk === 'critical' ? 'destructive' : drill.risk === 'high' ? 'default' : 'secondary'}
                  >
                    {drill.risk}
                  </Badge>
                </div>
                <h3 className="font-medium">{drill.name}</h3>
                <Button 
                  onClick={() => runDrill(drill.key)}
                  disabled={isRunningDrill || !!activeDrill}
                  className="w-full"
                  variant={drill.risk === 'critical' ? 'destructive' : 'default'}
                >
                  {isRunningDrill ? 'Running...' : 'Start Drill'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              Latest Drill Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{lastResult.drillType}</span>
              <Badge variant={lastResult.success ? 'default' : 'destructive'}>
                {lastResult.success ? 'SUCCESS' : 'ISSUES'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Detection Time:</span>
                <div className={`font-mono ${getPerformanceColor(lastResult.detectedIn, 'detection')}`}>
                  {lastResult.detectedIn}ms
                </div>
              </div>
              <div>
                <span className="text-gray-500">Recovery Time:</span>
                <div className={`font-mono ${getPerformanceColor(lastResult.recoveredIn, 'recovery')}`}>
                  {lastResult.recoveredIn}ms
                </div>
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-sm">Procedures Followed:</span>
              <ul className="mt-1 text-sm space-y-1">
                {lastResult.proceduresFollowed.map((procedure, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    {procedure}
                  </li>
                ))}
              </ul>
            </div>

            {lastResult.issues.length > 0 && (
              <div>
                <span className="text-red-600 text-sm font-medium">Issues:</span>
                <ul className="mt-1 text-sm space-y-1">
                  {lastResult.issues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drill History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Drill History
          </CardTitle>
          <CardDescription>
            Recent emergency drills and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drillHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No drills executed yet. Run your first emergency drill above.
            </p>
          ) : (
            <div className="space-y-3">
              {drillHistory.slice(0, 10).map((drill, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {drill.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-medium">{drill.drillType}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(drill.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className={getPerformanceColor(drill.detectedIn, 'detection')}>
                      Detected: {drill.detectedIn}ms
                    </div>
                    <div className={getPerformanceColor(drill.recoveredIn, 'recovery')}>
                      Recovered: {drill.recoveredIn}ms
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}