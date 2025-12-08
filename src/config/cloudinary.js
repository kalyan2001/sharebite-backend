import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const configureCloudinary = () => {
  try {
    // 1: Try individual env vars first
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
      });
      console.log('✅ Cloudinary configured from individual env vars');
      return true;
    }
    
    // 2: Try parsing CLOUDINARY_URL
    if (process.env.CLOUDINARY_URL) {
      const url = process.env.CLOUDINARY_URL;
      const matches = url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
      
      if (matches) {
        const [, api_key, api_secret, cloud_name] = matches;
        cloudinary.config({
          cloud_name,
          api_key,
          api_secret,
          secure: true
        });
        console.log('✅ Cloudinary configured from CLOUDINARY_URL');
        return true;
      }
    }
    
    console.log('❌ Cloudinary configuration failed - no valid credentials found');
    return false;
    
  } catch (error) {
    console.log('❌ Cloudinary configuration error:', error.message);
    return false;
  }
};

// Configure immediately
const isConfigured = configureCloudinary();

// Verify configuration
console.log('Cloudinary verification:', {
  cloud_name: cloudinary.config().cloud_name,
  api_key: cloudinary.config().api_key ? '✓' : '✗', 
  api_secret: cloudinary.config().api_secret ? '✓' : '✗'
});

export default cloudinary;