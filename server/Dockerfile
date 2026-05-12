# server/Dockerfile

# Utiliser l'image de base de Go la plus récente
FROM golang:latest

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers go.mod et go.sum dans le conteneur
COPY go.mod go.sum ./

# Télécharger les dépendances Go
RUN go mod download

# Copier le reste des fichiers de l'application dans le conteneur
COPY . .

# Construire le serveur HTTP et le CLI d'administration
RUN go build -o sigma-finance-server ./cmd
RUN go build -o sigma-finance ./cmd/bun

# Exposer le port sur lequel l'application Go sera accessible
EXPOSE 8080

# Définir la commande pour démarrer l'application
CMD ["./sigma-finance-server"]
