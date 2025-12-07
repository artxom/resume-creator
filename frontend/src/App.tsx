import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Tabs, Tab, Box, Container } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import StorageIcon from '@mui/icons-material/Storage';
import LinkIcon from '@mui/icons-material/Link';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DataImporter from './components/DataImporter';
import DataManager from './components/DataManager';
import FieldMapper from './components/FieldMapper';
import ResumeWizard from './components/ResumeWizard';
import AIStudio from './components/AIStudio';
import './App.css';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

function App() {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            QuantumLeap Synthesis Engine v3.2.0 (Wizard Edition)
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={value} onChange={handleChange} aria-label="main feature tabs">
            <Tab icon={<UploadFileIcon />} label="数据导入" {...a11yProps(0)} />
            <Tab icon={<StorageIcon />} label="数据管理" {...a11yProps(1)} />
            <Tab icon={<LinkIcon />} label="字段映射" {...a11yProps(2)} />
            <Tab icon={<DescriptionIcon />} label="智能简历向导" {...a11yProps(3)} />
            <Tab icon={<AutoFixHighIcon />} label="AI 实验室" {...a11yProps(4)} />
          </Tabs>
        </Box>
        <TabPanel value={value} index={0}>
          <DataImporter />
        </TabPanel>
        <TabPanel value={value} index={1}>
          <DataManager />
        </TabPanel>
        <TabPanel value={value} index={2}>
          <FieldMapper />
        </TabPanel>
        <TabPanel value={value} index={3}>
          <ResumeWizard />
        </TabPanel>
        <TabPanel value={value} index={4}>
          <AIStudio />
        </TabPanel>
      </Container>
    </Box>
  );
}

export default App;

