import React, { useEffect } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import AppTheme from './shared-theme/AppTheme';
import AppAppBar from './components/AppAppBar';
import MainContent from './components/MainContent';
import Latest from './components/Latest';
import Footer from './components/Footer';

export default function Blog(props) {
useEffect(() => {
  const token = localStorage.getItem('token')
  fetch('http://localhost:3333/authen', {
    method: 'POST', // หรือ 'PUT'
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '+token,
    },
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'ok'){
      // alert('OK AUTH REAL')
    }else {
      alert('OK AUTH FAKE')
      window.location = '/login'
    }
  })
  .catch(error => {
    console.error('Error:', error);
  });
}, [])

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <AppAppBar />
      <Container
        maxWidth="lg"
        component="main"
        sx={{ display: 'flex', flexDirection: 'column', my: 16, gap: 4 }}
      >
        <MainContent />
        <Latest />
      </Container>
      <Footer />
    </AppTheme>
  );
}