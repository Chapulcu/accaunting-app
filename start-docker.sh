#!/bin/bash

# Renkler
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Docker ortamı hazırlanıyor...${NC}"

# .env kontrolü
if [ ! -f .env ]; then
    echo -e "${YELLOW}UYARI: .env dosyası bulunamadı!${NC}"
    if [ -f .env.example ]; then
        echo -e "${GREEN}.env.example dosyasından .env oluşturuluyor...${NC}"
        cp .env.example .env
        echo -e "${YELLOW}Lütfen .env dosyasını düzenleyerek Supabase bilgilerinizi girin.${NC}"
        echo -e "${YELLOW}Supabase yerel olarak çalışıyorsa (npx supabase start), bilgiler şöyledir:${NC}"
        echo "VITE_SUPABASE_URL=http://127.0.0.1:54321"
        echo "VITE_SUPABASE_ANON_KEY=(supabase status çıktısından anon key)"
        exit 1
    else
        echo -e "${RED}HATA: .env.example da bulunamadı. Lütfen gerekli ortam değişkenlerini ayarlayın.${NC}"
        exit 1
    fi
fi

# Supabase kontrolü (Basit bir port kontrolü)
# Port 54321 genellikle Supabase API portudur
if ! nc -z localhost 54321; then
    echo -e "${YELLOW}UYARI: Supabase yerel sunucusu (port 54321) çalışmıyor gibi görünüyor.${NC}"
    echo -e "${YELLOW}Eğer backend'i yerel olarak çalıştıracaksanız, ayrı bir terminalde şu komutu çalıştırın:${NC}"
    echo -e "${GREEN}npx supabase start${NC}"
    echo -e "${YELLOW}Devam edilsin mi? (e/h)${NC}"
    read -r response
    if [[ "$response" != "e" ]]; then
        exit 0
    fi
fi

echo -e "${GREEN}Docker konteynerleri başlatılıyor...${NC}"
# --build: Her seferinde yeniden build et (değişiklikleri algılamak için)
docker-compose up --build

