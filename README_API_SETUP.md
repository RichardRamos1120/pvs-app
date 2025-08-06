# API Configuration Setup

## Environment Variables

This project uses environment variables to securely store API tokens. Follow these steps to set up your development environment:

### 1. Create Environment File

Copy the example environment file:
```bash
cp .env.example .env
```

### 2. Get Regrid API Token

1. Go to [Regrid API](https://regrid.com/api)
2. Sign up for a free trial account
3. Generate an API token
4. Copy your token

### 3. Configure Environment

Edit `.env` file and replace `your_regrid_api_token_here` with your actual token:

```bash
REACT_APP_REGRID_API_TOKEN=your_actual_token_here
```

### 4. Restart Development Server

After adding the environment variable:
```bash
npm start
```

## API Coverage

The free trial includes data for these counties only:
- Dallas County, Texas ✅
- Marion County, Indiana ✅  
- Wilson County, Tennessee ✅
- Durham County, North Carolina ✅
- Fillmore County, Nebraska ✅
- Clark County, Wisconsin ✅
- Gurabo Municipio, Puerto Rico ✅

For nationwide coverage, contact Regrid for pricing information.

## Security Notes

- ✅ `.env` file is in `.gitignore` - won't be committed
- ✅ Use `REACT_APP_` prefix for React environment variables
- ✅ Keep API tokens private and never commit them to version control
- 🔄 Regenerate tokens if accidentally exposed

## Testing the Setup

Try searching for addresses in Dallas, TX to test the API connection:
- "1600 Pennsylvania Ave" (finds Dallas results)  
- "407 e f" (API documentation example)
- Any Dallas County address