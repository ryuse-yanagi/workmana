FROM php:8.3-fpm

WORKDIR /var/www/html

RUN apt-get update && apt-get install -y \
    nginx \
    git \
    unzip \
    libpq-dev \
    && docker-php-ext-install pdo_pgsql pcntl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

COPY . .

RUN composer install --no-dev --optimize-autoloader \
    && rm -f /etc/nginx/sites-enabled/default \
    && cp nginx/default.conf /etc/nginx/sites-enabled/default \
    && cp nginx/websocket-map.conf /etc/nginx/conf.d/websocket-map.conf \
    && cp docker/zz-cloudwatch.conf /usr/local/etc/php-fpm.d/zz-cloudwatch.conf \
    && cp docker/php-cloudwatch.ini /usr/local/etc/php/conf.d/zz-cloudwatch.ini \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80 8080

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
