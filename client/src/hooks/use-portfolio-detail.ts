import { useQuery } from "@apollo/client";
import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { GET_PORTFOLIO } from "@/graphql/queries/portfolios";
import { usePortfolioManagement } from "./use-portfolio-management";
import { useAuth } from "@/lib/auth-context";
import type { Portfolio } from "@/gql/graphql";

interface UsePortfolioDetailOptions {
  portfolioId: string;
  onDeleteSuccess?: () => void;
  onUpdateSuccess?: () => void;
}

export function usePortfolioDetail({ 
  portfolioId, 
  onDeleteSuccess,
  onUpdateSuccess 
}: UsePortfolioDetailOptions) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { deletePortfolio, updatePortfolio } = usePortfolioManagement();
  
  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch individual portfolio
  const { data, loading, error, refetch } = useQuery(GET_PORTFOLIO, {
    variables: { id: portfolioId },
    errorPolicy: "all",
    fetchPolicy: "cache-and-network",
    skip: !portfolioId,
  });

  const portfolio = data?.portfolio as Portfolio | null;

  // Check if user owns this portfolio
  const isOwner = portfolio?.user?.id === user?.id;
  const isUnauthorized = portfolio && !isOwner;

  // Navigation handlers
  const navigateToEdit = useCallback(() => {
    navigate({ to: `/portfolios/${portfolioId}/edit` });
  }, [navigate, portfolioId]);

  const navigateToList = useCallback(() => {
    navigate({ to: "/portfolios" });
  }, [navigate]);

  const navigateToDuplicate = useCallback(() => {
    // TODO: Implement duplicate navigation when duplicate page is created
    console.log("Navigate to duplicate portfolio:", portfolioId);
  }, [portfolioId]);

  // Delete handlers
  const handleDeleteClick = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!portfolio) return;

    setIsDeleting(true);
    try {
      await deletePortfolio(portfolioId);
      toast.success(`Portfolio "${portfolio.name}" has been deleted`);
      setShowDeleteDialog(false);
      
      // Call success callback or navigate to list
      if (onDeleteSuccess) {
        onDeleteSuccess();
      } else {
        navigateToList();
      }
    } catch (error) {
      console.error("Failed to delete portfolio:", error);
      toast.error("Failed to delete portfolio. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [portfolio, portfolioId, deletePortfolio, onDeleteSuccess, navigateToList]);

  // Update handlers
  const handleUpdate = useCallback(async (input: { name?: string; description?: string }) => {
    if (!portfolio) return;

    try {
      await updatePortfolio(portfolioId, input);
      toast.success("Portfolio updated successfully");
      
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
      
      // Refetch to get updated data
      await refetch();
    } catch (error) {
      console.error("Failed to update portfolio:", error);
      toast.error("Failed to update portfolio. Please try again.");
      throw error;
    }
  }, [portfolio, portfolioId, updatePortfolio, onUpdateSuccess, refetch]);

  // Export handler (placeholder)
  const handleExport = useCallback(() => {
    if (!portfolio) return;
    
    // TODO: Implement actual export functionality
    toast.info("Export functionality coming soon");
    console.log("Export portfolio:", portfolio.name);
  }, [portfolio]);

  // Duplicate handler (placeholder)
  const handleDuplicate = useCallback(() => {
    if (!portfolio) return;
    
    // TODO: Implement actual duplicate functionality
    toast.info("Duplicate functionality coming soon");
    console.log("Duplicate portfolio:", portfolio.name);
  }, [portfolio]);

  // Retry handler for failed requests
  const retry = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error("Failed to retry:", error);
      toast.error("Failed to reload portfolio. Please try again.");
    }
  }, [refetch]);

  return {
    // Data
    portfolio,
    isOwner,
    isUnauthorized,
    
    // Loading states
    loading,
    isDeleting,
    
    // Error states
    error,
    hasError: !!error,
    
    // Dialog states
    showDeleteDialog,
    
    // Actions
    navigateToEdit,
    navigateToList,
    navigateToDuplicate,
    handleDeleteClick,
    handleDeleteCancel,
    handleDeleteConfirm,
    handleUpdate,
    handleExport,
    handleDuplicate,
    retry,
    refetch,
    
    // Dialog handlers
    setShowDeleteDialog,
  };
}