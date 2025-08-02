import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Checkbox, 
  FormControlLabel,
  Grid,
  CircularProgress
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AuthContext from '../context/AuthContext';

const useStyles = makeStyles((theme) => ({
  formContainer: {
    padding: theme.spacing(3),
    marginTop: theme.spacing(3),
  },
  mapContainer: {
    height: '300px',
    width: '100%',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  formField: {
    marginBottom: theme.spacing(2),
  },
}));

const validationSchema = Yup.object().shape({
  title: Yup.string().required('Title is required').max(120),
  description: Yup.string().required('Description is required'),
  category: Yup.string().required('Category is required'),
});

function LocationMarker({ setPosition }) {
  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return null;
}

function ReportIssuePage() {
  const classes = useStyles();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [position, setPosition] = useState(null);
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error("Error getting location", err);
        setPosition([51.505, -0.09]); // Default to London if geolocation fails
      }
    );
  }, []);

  const handleFileChange = (e) => {
    setFiles([...e.target.files]);
  };

  const handleSubmit = async (values) => {
    if (!position) {
      alert('Please select a location on the map');
      return;
    }

    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('title', values.title);
    formData.append('description', values.description);
    formData.append('category', values.category);
    formData.append('latitude', position[0]);
    formData.append('longitude', position[1]);
    formData.append('is_anonymous', values.is_anonymous);
    
    files.forEach(file => {
      formData.append('images', file);
    });

    try {
      await axios.post('/api/issues', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      navigate('/');
    } catch (err) {
      console.error("Error reporting issue", err);
      alert('Failed to report issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        Report an Issue
      </Typography>
      
      <Paper className={classes.formContainer}>
        <Formik
          initialValues={{
            title: '',
            description: '',
            category: '',
            is_anonymous: false,
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ values, handleChange }) => (
            <Form>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    name="title"
                    label="Title"
                    fullWidth
                    className={classes.formField}
                    variant="outlined"
                  />
                  <ErrorMessage name="title" component="div" className="error" />
                  
                  <Field
                    as={TextField}
                    name="description"
                    label="Description"
                    fullWidth
                    multiline
                    rows={4}
                    className={classes.formField}
                    variant="outlined"
                  />
                  <ErrorMessage name="description" component="div" className="error" />
                  
                  <FormControl fullWidth className={classes.formField} variant="outlined">
                    <InputLabel>Category</InputLabel>
                    <Field
                      as={Select}
                      name="category"
                      label="Category"
                    >
                      <MenuItem value="Roads">Roads</MenuItem>
                      <MenuItem value="Lighting">Lighting</MenuItem>
                      <MenuItem value="Water Supply">Water Supply</MenuItem>
                      <MenuItem value="Cleanliness">Cleanliness</MenuItem>
                      <MenuItem value="Public Safety">Public Safety</MenuItem>
                      <MenuItem value="Obstructions">Obstructions</MenuItem>
                    </Field>
                  </FormControl>
                  <ErrorMessage name="category" component="div" className="error" />
                  
                  <FormControlLabel
                    control={
                      <Field 
                        as={Checkbox} 
                        name="is_anonymous" 
                        color="primary" 
                      />
                    }
                    label="Report Anonymously"
                  />
                  
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="raised-button-file"
                    multiple
                    type="file"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="raised-button-file">
                    <Button 
                      variant="contained" 
                      component="span" 
                      className={classes.formField}
                    >
                      Upload Images (Max 3)
                    </Button>
                  </label>
                  {files.length > 0 && (
                    <Typography variant="body2">
                      {files.length} file(s) selected
                    </Typography>
                  )}
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Click on the map to set the issue location
                  </Typography>
                  {position && (
                    <div className={classes.mapContainer}>
                      <MapContainer 
                        center={position} 
                        zoom={15} 
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <Marker position={position} />
                        <LocationMarker setPosition={setPosition} />
                      </MapContainer>
                    </div>
                  )}
                  <Typography variant="body2">
                    Latitude: {position ? position[0].toFixed(6) : 'N/A'}, 
                    Longitude: {position ? position[1].toFixed(6) : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
              
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
              >
                {isSubmitting ? 'Submitting...' : 'Report Issue'}
              </Button>
            </Form>
          )}
        </Formik>
      </Paper>
    </Container>
  );
}

export default ReportIssuePage;