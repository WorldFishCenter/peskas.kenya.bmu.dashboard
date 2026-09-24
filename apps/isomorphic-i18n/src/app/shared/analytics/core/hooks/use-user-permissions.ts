import { useSession } from "next-auth/react";
import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useCallback } from 'react';

// Create an atom to store the admin's selected reference BMU
export const adminReferenceBmuAtom = atomWithStorage<string | null>('adminReferenceBmu', null);

/**
 * Centralized hook for user permission management
 * 
 * Provides consistent access to user role/permission information and helper functions
 * for determining what data a user can access based on their role.
 */
export const useUserPermissions = () => {
  const { data: session } = useSession();
  const [adminReferenceBmu, setAdminReferenceBmu] = useAtom(adminReferenceBmuAtom);
  

  
  // Check user groups for permission levels with safety checks
  const hasGroups = Array.isArray(session?.user?.groups);
  
  const isCiaUser = hasGroups && session?.user?.groups?.some(
    (group: { name: string }) => group.name === 'CIA'
  );
  
  const isWbciaUser = hasGroups && session?.user?.groups?.some(
    (group: { name: string }) => group.name === 'WBCIA'
  );
  
  const isAdmin = hasGroups && session?.user?.groups?.some(
    (group: { name: string }) => group.name === 'admin' || group.name === 'Admin'
  );
  
  const isIiaUser = hasGroups && session?.user?.groups?.some(
    (group: { name: string }) => group.name === 'IIA'
  );
  
  const isAiaUser = hasGroups && session?.user?.groups?.some(
    (group: { name: string }) => group.name === 'AIA'
  );
  
  // Get user's BMU - properly handle the property path
  const userBMU = session?.user?.userBmu?.BMU;
  
  // Get user's fisher ID for IIA users
  const userFisherId = session?.user?.fisherId;
  
  // For admin users, they can select a reference BMU
  const referenceBMU = isAdmin ? adminReferenceBmu : userBMU;
  
  /**
   * Determines which BMUs the user can access based on their role
   * 
   * @param allBMUs - Array of all available BMUs
   * @returns Array of BMUs the user has access to
   */
  const getAccessibleBMUs = useCallback((allBMUs: string[]): string[] => {
    if (isAdmin) {
      // Admins can see all BMUs
      return allBMUs;
    } else if (isWbciaUser) {
      // WBCIA users can see BMUs in their region (for now, assuming they can see all)
      // This would need to be enhanced with region filtering logic
      return allBMUs;
    } else if ((isCiaUser || isAiaUser) && userBMU) {
      // CIA and AIA users can only see their assigned BMU
      return [userBMU];
    } else if (isIiaUser) {
      // IIA users don't see BMU-level data, return empty array
      return [];
    } else {
      // Default fallback - show all but with limited interactions
      return allBMUs;
    }
  }, [isAdmin, isWbciaUser, isCiaUser, isAiaUser, isIiaUser, userBMU]);
  
  /**
   * Get a limited selection of BMUs to display for admins
   * 
   * @param allBMUs - Array of all available BMUs
   * @param limit - Maximum number of BMUs to return
   * @returns Limited array of BMUs for visualization
   */
  const getLimitedBMUs = useCallback((allBMUs: string[], limit: number = 8): string[] => {
    if (!isAdmin) {
      return getAccessibleBMUs(allBMUs);
    }
    
    // If admin has a reference BMU, include it in the selection
    const result: string[] = [];
    
    if (adminReferenceBmu && allBMUs.includes(adminReferenceBmu)) {
      result.push(adminReferenceBmu);
    }
    
    // Add other BMUs up to the limit
    const remainingBMUs = allBMUs.filter(bmu => bmu !== adminReferenceBmu);
    const remainingLimit = limit - result.length;
    
    if (remainingLimit > 0) {
      result.push(...remainingBMUs.slice(0, remainingLimit));
    }
    
    return result;
  }, [isAdmin, adminReferenceBmu, getAccessibleBMUs]);
  
  // Detect if user is an administrator who is also an active fisher
  const isAdminFisher = (isWbciaUser || isCiaUser || isAdmin) && !!userFisherId;
  
  return {
    // User information
    userBMU,
    referenceBMU,
    userFisherId,
    
    // Admin reference BMU management
    adminReferenceBmu,
    setAdminReferenceBmu,
    
    // Role checks
    isCiaUser,
    isWbciaUser,
    isAdmin,
    isIiaUser,
    isAiaUser,
    
    // New integrated user type
    isAdminFisher,
    
    // Helper functions
    getAccessibleBMUs,
    getLimitedBMUs,
    
    // Useful flags for components
    hasRestrictedAccess: ((isCiaUser || isAiaUser) && !!userBMU) || (isIiaUser && !!userFisherId),
    shouldShowAggregated: isAdmin || isWbciaUser || isCiaUser || isAiaUser,
    shouldShowIndividualData: isIiaUser || isAdminFisher,
    canCompareWithOthers: (!isCiaUser && !isIiaUser && !isAiaUser) || isAdmin || isWbciaUser,
    canSeeBMUData: !isIiaUser,
    
    // New unified dashboard flags
    shouldShowUnifiedDashboard: isAdminFisher,
    shouldShowPersonalPerformance: isIiaUser || isAdminFisher,
  };
};

export default useUserPermissions; 