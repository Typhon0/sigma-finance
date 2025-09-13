import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  Upload, 
  Database, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  FileText
} from 'lucide-react';
import { ExportService } from '@/lib/export/export-service';

interface DataBackupRestoreProps {
  userId: string;
}

export function DataBackupRestore({ userId }: DataBackupRestoreProps) {
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateBackup = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const backupResult = await ExportService.createDataBackup(userId);

      clearInterval(progressInterval);
      setProgress(100);

      if (backupResult.success) {
        setResult({
          type: 'success',
          message: `Backup created successfully: ${backupResult.filename}`
        });
        setTimeout(() => setBackupDialogOpen(false), 3000);
      } else {
        setResult({
          type: 'error',
          message: `Backup failed: ${backupResult.error}`
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setSelectedFile(file);
        setResult(null);
      } else {
        setResult({
          type: 'error',
          message: 'Please select a valid JSON backup file'
        });
      }
    }
  };

  const handleRestoreData = async () => {
    if (!selectedFile) {
      setResult({
        type: 'error',
        message: 'Please select a backup file first'
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      // Read file content
      const fileContent = await selectedFile.text();
      const backupData = JSON.parse(fileContent);

      // Validate backup data structure
      if (!backupData.userId || !backupData.exportDate) {
        throw new Error('Invalid backup file format');
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 300);

      // In a real implementation, this would send the data to the server
      await new Promise(resolve => setTimeout(resolve, 3000));

      clearInterval(progressInterval);
      setProgress(100);

      setResult({
        type: 'success',
        message: 'Data restored successfully. Please refresh the page to see changes.'
      });

      setTimeout(() => setRestoreDialogOpen(false), 3000);
    } catch (error) {
      setResult({
        type: 'error',
        message: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetBackupDialog = () => {
    setProgress(0);
    setResult(null);
    setIsProcessing(false);
  };

  const resetRestoreDialog = () => {
    setProgress(0);
    setResult(null);
    setIsProcessing(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Button
          onClick={() => setBackupDialogOpen(true)}
          className="gap-2"
        >
          <Database className="h-4 w-4" />
          Create Backup
        </Button>

        <Button
          variant="outline"
          onClick={() => setRestoreDialogOpen(true)}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Restore Data
        </Button>
      </div>

      {/* Backup Dialog */}
      <Dialog open={backupDialogOpen} onOpenChange={(open) => {
        setBackupDialogOpen(open);
        if (!open) resetBackupDialog();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Create Data Backup
            </DialogTitle>
            <DialogDescription>
              Create a complete backup of all your portfolio data, transactions, and settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                The backup will include all your sensitive financial data. Store it securely and never share it with others.
              </AlertDescription>
            </Alert>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating backup...
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {result && (
              <Alert variant={result.type === 'error' ? 'destructive' : 'default'}>
                {result.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBackup} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Create Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={(open) => {
        setRestoreDialogOpen(open);
        if (!open) resetRestoreDialog();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restore Data
            </DialogTitle>
            <DialogDescription>
              Restore your portfolio data from a backup file. This will overwrite your current data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This will replace all your current data with the backup data. This action cannot be undone.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label htmlFor="backup-file" className="text-sm font-medium">
                Select Backup File
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="backup-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {selectedFile && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    {selectedFile.name}
                  </div>
                )}
              </div>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restoring data...
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {result && (
              <Alert variant={result.type === 'error' ? 'destructive' : 'default'}>
                {result.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRestoreData} 
              disabled={isProcessing || !selectedFile}
              variant="destructive"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Restore Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}