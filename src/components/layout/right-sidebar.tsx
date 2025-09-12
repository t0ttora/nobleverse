'use client';
import * as React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { Plus, Calendar, MessageCircle, Bell, BarChart2 } from 'lucide-react';

export const TOOL_LIST = [
  {
    key: 'calendar',
    icon: Calendar,
    label: 'Smart Calendar'
  },
  {
    key: 'chat',
    icon: MessageCircle,
    label: 'NobleChat'
  },
  {
    key: 'notifications',
    icon: Bell,
    label: 'Notification Center'
  },
  {
    key: 'insights',
    icon: BarChart2,
    label: 'Quick Insights'
  }
];

export function RightSidebar({
  openTool,
  setOpenTool
}: {
  openTool: string | null;
  setOpenTool: (tool: string | null) => void;
}) {
  // Her zaman collapsed (ikon-only) görünümde başlat ve değiştirilemez
  return (
    <Sidebar side='right' collapsible='icon'>
      <SidebarHeader />
      <SidebarContent className='overflow-x-hidden'>
        <SidebarGroup>
          <SidebarGroupLabel className='sr-only'>Tools</SidebarGroupLabel>
          <SidebarMenu>
            {TOOL_LIST.map((tool) => (
              <SidebarMenuItem key={tool.key}>
                <SidebarMenuButton
                  tooltip={tool.label}
                  isActive={openTool === tool.key}
                  onClick={() =>
                    setOpenTool(openTool === tool.key ? null : tool.key)
                  }
                >
                  <tool.icon />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip='Add Tool'>
              <Plus />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
