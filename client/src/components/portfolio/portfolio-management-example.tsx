import React, { useState } from 'react';
import { usePortfolioManagement, usePortfolioCreation, usePortfolioOperations } from '@/hooks/use-portfolio-management';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Edit, Trash2, Copy } from 'lucide-react';

/**
 * Example component demonstrating the enhanced portfolio management hook
 * This shows how to use the hook with proper loading states, error handling, and optimistic updates
 */
export function PortfolioManagementExample() {
  const {
    portfolios,
    loading,
    hasError,
    error,
    canRetry,
    retry,
    clearError,
    isCreating,
    isUpdating,
    isDeleting,
    isDuplicating,
  } = usePortfolioManagement();

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading portfolios...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error?.message || 'An error occurred while loading portfolios.'}
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
              className="ml-2"
            >
              Retry
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="ml-2"
          >
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Portfolio Management</h2>
        <PortfolioCreationForm />
      </div>

      {portfolios?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No portfolios found</p>
            <PortfolioCreationForm />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {portfolios?.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              isSelected={selectedPortfolioId === portfolio.id}
              onSelect={() => setSelectedPortfolioId(portfolio.id)}
            />
          ))}
        </div>
      )}

      {/* Loading indicators for operations */}
      {(isCreating || isUpdating || isDeleting || isDuplicating) && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-4 shadow-lg">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">
              {isCreating && 'Creating portfolio...'}
              {isUpdating && 'Updating portfolio...'}
              {isDeleting && 'Deleting portfolio...'}
              {isDuplicating && 'Duplicating portfolio...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioCreationForm() {
  const {
    createPortfolio,
    isCreating,
    hasError,
    error,
    clearError,
    createdPortfolio,
    resetCreatedPortfolio,
  } = usePortfolioCreation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createPortfolio({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      setShowForm(false);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  React.useEffect(() => {
    if (createdPortfolio) {
      // Portfolio was created successfully
      console.log('Portfolio created:', createdPortfolio);
      resetCreatedPortfolio();
    }
  }, [createdPortfolio, resetCreatedPortfolio]);

  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)} disabled={isCreating}>
        <Plus className="h-4 w-4 mr-2" />
        Create Portfolio
      </Button>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create New Portfolio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasError && (
            <Alert variant="destructive">
              <AlertDescription>
                {error?.message || 'Failed to create portfolio'}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="ml-2"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Input
              placeholder="Portfolio name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              required
            />
          </div>

          <div>
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="flex space-x-2">
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PortfolioCard({ 
  portfolio, 
  isSelected, 
  onSelect 
}: { 
  portfolio: any; 
  isSelected: boolean; 
  onSelect: () => void; 
}) {
  const {
    updatePortfolio,
    deletePortfolio,
    duplicatePortfolio,
    isLoading,
    hasError,
    error,
    clearError,
  } = usePortfolioOperations(portfolio.id);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(portfolio.name);
  const [editDescription, setEditDescription] = useState(portfolio.description || '');

  const handleUpdate = async () => {
    try {
      await updatePortfolio({
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setIsEditing(false);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this portfolio? This action cannot be undone.')) {
      try {
        await deletePortfolio();
      } catch (error) {
        // Error is handled by the hook
      }
    }
  };

  const handleDuplicate = async () => {
    const newName = prompt('Enter name for the duplicated portfolio:', `${portfolio.name} (Copy)`);
    if (newName) {
      try {
        await duplicatePortfolio(newName, { copyAssets: true });
      } catch (error) {
        // Error is handled by the hook
      }
    }
  };

  return (
    <Card className={`cursor-pointer transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader onClick={onSelect}>
        <CardTitle className="flex items-center justify-between">
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="text-lg font-semibold"
            />
          ) : (
            <span>{portfolio.name}</span>
          )}
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(!isEditing);
              }}
              disabled={isLoading}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicate();
              }}
              disabled={isLoading}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent onClick={onSelect}>
        {hasError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {error?.message || 'An error occurred'}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-2"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isEditing ? (
          <div className="space-y-2">
            <Input
              placeholder="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex space-x-2">
              <Button size="sm" onClick={handleUpdate} disabled={isLoading}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {portfolio.description || 'No description'}
            </p>
            <p className="text-xs text-muted-foreground">
              Created: {new Date(portfolio.createdAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-muted-foreground">
              Assets: {portfolio.assets?.length || 0}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center mt-2">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Processing...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}