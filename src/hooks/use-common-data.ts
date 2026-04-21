import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useProfiles = () => {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email, phone, branch_id');
      return data || [];
    },
  });
};

export const useUserRoles = (roles?: string[]) => {
  return useQuery({
    queryKey: ['user-roles', roles],
    queryFn: async () => {
      if (roles && roles.length > 0) {
        const { data } = await supabase.from('user_roles').select('user_id, role').in('role', roles as any);
        return data || [];
      }
      const { data } = await supabase.from('user_roles').select('user_id, role');
      return data || [];
    },
  });
};

export const useWorkers = () => useUserRoles(['workshop_worker', 'sales_officer']);

export const useAllWallets = () => {
  return useQuery({
    queryKey: ['all-wallets'],
    queryFn: async () => {
      const { data } = await supabase.from('wallets').select('*');
      return data || [];
    },
  });
};

export const useInventoryMaterials = () => {
  return useQuery({
    queryKey: ['inventory-materials'],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_materials').select('*');
      return data || [];
    },
  });
};

export const useProductionOrders = () => {
  return useQuery({
    queryKey: ['production-orders'],
    queryFn: async () => {
      const { data } = await supabase.from('production_orders').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });
};

export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*').order('name');
      return data || [];
    },
  });
};