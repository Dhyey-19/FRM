import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, TextField, Button, Alert, 
  CircularProgress, Divider, Card, CardContent
} from '@mui/material';
import { Business as BusinessIcon, Save as SaveIcon, Edit as EditIcon, Info as InfoIcon } from '@mui/icons-material';

const CompanyProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [formData, setFormData] = useState({
    CompanyName: '',
    Address1: '',
    Address2: '',
    City: '',
    StateName: '',
    CountryName: '',
    Pincode: '',
    ContactPerson: '',
    PhoneNo: '',
    MobileNo: '',
    EmailID: '',
    Website: '',
    GSTIN: '',
    PANNo: '',
    BankName: '',
    BranchName: '',
    AccountNo: '',
    IFSCCode: '',
    UPI: ''
  });

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`);
      const data = await response.json();
      if (response.ok && data) {
        setFormData({
          CompanyName: data.CompanyName || '',
          Address1: data.Address1 || '',
          Address2: data.Address2 || '',
          City: data.City || '',
          StateName: data.StateName || '',
          CountryName: data.CountryName || '',
          Pincode: data.Pincode || '',
          ContactPerson: data.ContactPerson || '',
          PhoneNo: data.PhoneNo || '',
          MobileNo: data.MobileNo || '',
          EmailID: data.EmailID || '',
          Website: data.Website || '',
          GSTIN: data.GSTIN || '',
          PANNo: data.PANNo || '',
          BankName: data.BankName || '',
          BranchName: data.BranchName || '',
          AccountNo: data.AccountNo || '',
          IFSCCode: data.IFSCCode || '',
          UPI: data.UPI || ''
        });
        setProfileExists(true);
      } else {
        setProfileExists(false);
      }
    } catch (error) {
      console.error('Error fetching company profile:', error);
      setMessage({ type: 'error', text: 'Failed to load company profile.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.CompanyName.trim()) {
      setMessage({ type: 'error', text: 'Company Name is required.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`;
      const method = profileExists ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Company profile saved successfully.' });
        setProfileExists(true);
        
        // Update local storage so the new company name reflects globally (e.g. in reports)
        const current = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
        current.companyName = formData.CompanyName;
        localStorage.setItem('user', JSON.stringify(current));
        // Force a page reload or dispatch an event if needed, but localStorage update is sufficient
        // for subsequent report loads.
      } else {
        setMessage({ type: 'error', text: data.message || 'Error saving company profile.' });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Action failed. Please check the backend connection.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1200px', margin: '0 auto', p: 1 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <BusinessIcon sx={{ fontSize: 32, color: '#0F3B66' }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
          Company Profile Configuration
        </Typography>
      </Box>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3, borderRadius: 2 }}>
          {message.text}
        </Alert>
      )}

      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3, borderRadius: 2 }}>
        {profileExists 
          ? "A company profile is already configured. You can edit and save changes to this record." 
          : "No company profile found. Please fill in the details below to create the initial record (only one company record is permitted)."}
      </Alert>

      <form onSubmit={handleSave}>
        <Grid container spacing={3}>
          {/* General Information Section */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                  General Company Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="Company Name" 
                      name="CompanyName" 
                      value={formData.CompanyName} 
                      onChange={handleChange} 
                      required 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField 
                      fullWidth 
                      label="GSTIN" 
                      name="GSTIN" 
                      value={formData.GSTIN} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField 
                      fullWidth 
                      label="PAN No" 
                      name="PANNo" 
                      value={formData.PANNo} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Address Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                  Registered Office Address
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Address Line 1" 
                      name="Address1" 
                      value={formData.Address1} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Address Line 2" 
                      name="Address2" 
                      value={formData.Address2} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="City" 
                      name="City" 
                      value={formData.City} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="State" 
                      name="StateName" 
                      value={formData.StateName} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="Country" 
                      name="CountryName" 
                      value={formData.CountryName} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="Pincode" 
                      name="Pincode" 
                      value={formData.Pincode} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Contact Details Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                  Contact Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Contact Person" 
                      name="ContactPerson" 
                      value={formData.ContactPerson} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="Phone No" 
                      name="PhoneNo" 
                      value={formData.PhoneNo} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      fullWidth 
                      label="Mobile No" 
                      name="MobileNo" 
                      value={formData.MobileNo} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Email ID" 
                      name="EmailID" 
                      type="email" 
                      value={formData.EmailID} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth 
                      label="Website" 
                      name="Website" 
                      value={formData.Website} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Bank Details Section */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                  Bank Details & UPI
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      label="Bank Name" 
                      name="BankName" 
                      value={formData.BankName} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      label="Branch Name" 
                      name="BranchName" 
                      value={formData.BranchName} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField 
                      fullWidth 
                      label="Account No" 
                      name="AccountNo" 
                      value={formData.AccountNo} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="IFSC Code" 
                      name="IFSCCode" 
                      value={formData.IFSCCode} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="UPI ID" 
                      name="UPI" 
                      value={formData.UPI} 
                      onChange={handleChange} 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Submit Actions */}
          <Grid item xs={12} sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              size="large"
              startIcon={profileExists ? <EditIcon /> : <SaveIcon />}
              disabled={saving}
              sx={{ px: 4, py: 1, borderRadius: 2 }}
            >
              {saving ? 'Saving...' : profileExists ? 'Update Profile' : 'Save Profile'}
            </Button>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default CompanyProfile;
