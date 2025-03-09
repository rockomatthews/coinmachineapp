"use client";

import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useRouter } from 'next/navigation';
import CreateIcon from '@mui/icons-material/Create';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import SettingsIcon from '@mui/icons-material/Settings';

export default function Sidebar({ open, onClose }) {
  const router = useRouter();

  const menuItems = [
    { text: 'Create a Coin', icon: <CreateIcon />, path: '/create' },
    { text: 'Staking', icon: <MonetizationOnIcon />, path: '/staking' },
    { text: 'Manage Coin', icon: <SettingsIcon />, path: '/manage' }
  ];

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 240,
          backgroundColor: 'black',
          color: 'white'
        }
      }}
    >
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => {
                router.push(item.path);
                onClose();
              }}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <ListItemIcon sx={{ color: 'white' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
} 