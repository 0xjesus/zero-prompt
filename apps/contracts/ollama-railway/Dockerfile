FROM ollama/ollama:latest

# Expose Ollama port
EXPOSE 11434

# Set environment to listen on all interfaces
ENV OLLAMA_HOST=0.0.0.0

# Start Ollama and pull the model
CMD ["sh", "-c", "ollama serve & sleep 15 && ollama pull tinyllama && ollama pull llama3.2:1b && wait"]
