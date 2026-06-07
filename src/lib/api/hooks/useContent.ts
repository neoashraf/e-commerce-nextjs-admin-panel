"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  pageListSchema, pageDetailSchema, createPageResultSchema,
  menuSchema, bannerListSchema, homeSectionListSchema,
  type PageRow, type PageDetail, type MenuItem, type Banner, type HomeSection,
} from "@/lib/api/schemas/content";

/** Admin CMS hooks (cms-pages-fe, cms-menus-fe, cms-merchandising-fe). */

// ---- Pages ----
export function usePages() {
  return useQuery({
    queryKey: ["admin-pages"] as const,
    queryFn: (): Promise<PageRow[]> => api.get("/admin/pages", { schema: pageListSchema }) as Promise<PageRow[]>,
    staleTime: 30_000,
  });
}
export function usePage(id: string) {
  return useQuery({
    queryKey: ["admin-page", id] as const,
    enabled: !!id,
    queryFn: (): Promise<PageDetail> => api.get(`/admin/pages/${id}`, { schema: pageDetailSchema }) as Promise<PageDetail>,
    staleTime: 30_000,
  });
}
interface PageBody { slug?: string; title: string; body: string; seo_title?: string; seo_description?: string; is_published?: boolean }
export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PageBody) => api.post("/admin/pages", body as unknown as Record<string, unknown>, { schema: createPageResultSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pages"] }),
  });
}
export function useUpdatePage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PageBody>) => api.patch(`/admin/pages/${id}`, body as unknown as Record<string, unknown>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-pages"] }); qc.invalidateQueries({ queryKey: ["admin-page", id] }); },
  });
}
export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pages"] }),
  });
}

// ---- Menus ----
export function useMenu(menu: "header" | "footer") {
  return useQuery({
    queryKey: ["admin-menu", menu] as const,
    queryFn: (): Promise<{ items: MenuItem[] }> => api.get(`/admin/menus/${menu}`, { schema: menuSchema }) as Promise<{ items: MenuItem[] }>,
    staleTime: 30_000,
  });
}
export function useSaveMenu(menu: "header" | "footer") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: MenuItem[]) => api.put(`/admin/menus/${menu}`, { items } as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-menu", menu] }),
  });
}

// ---- Banners ----
export function useBanners() {
  return useQuery({
    queryKey: ["admin-banners"] as const,
    queryFn: (): Promise<Banner[]> => api.get("/admin/banners", { schema: bannerListSchema }) as Promise<Banner[]>,
    staleTime: 30_000,
  });
}
export function useBannerActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-banners"] });
  return {
    create: useMutation({ mutationFn: (b: Partial<Banner>) => api.post("/admin/banners", b as unknown as Record<string, unknown>), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<Banner> }) => api.patch(`/admin/banners/${id}`, body as unknown as Record<string, unknown>), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.delete<void>(`/admin/banners/${id}`), onSuccess: invalidate }),
  };
}

// ---- Home sections ----
export function useHomeSections() {
  return useQuery({
    queryKey: ["admin-home-sections"] as const,
    queryFn: (): Promise<HomeSection[]> => api.get("/admin/home-sections", { schema: homeSectionListSchema }) as Promise<HomeSection[]>,
    staleTime: 30_000,
  });
}
export function useHomeSectionActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-home-sections"] });
  return {
    create: useMutation({ mutationFn: (s: Partial<HomeSection>) => api.post("/admin/home-sections", s as unknown as Record<string, unknown>), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<HomeSection> }) => api.patch(`/admin/home-sections/${id}`, body as unknown as Record<string, unknown>), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.delete<void>(`/admin/home-sections/${id}`), onSuccess: invalidate }),
  };
}
