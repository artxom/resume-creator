# Set the base image to Python
FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Copy the requirements file
COPY ./requirements.txt /app/requirements.txt

# Install dependencies
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

# Copy the application code
COPY . /app

# The command to run the application will be provided by docker-compose
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
