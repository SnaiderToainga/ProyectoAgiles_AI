FROM php:8.3.30-apache-bookworm@sha256:daf3cad5642798e462a029e41d6347cba7f3362f7028f8e60c3623dbadc4e590
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl util-linux libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 mysqli intl zip gd soap exif opcache \
    && rm -rf /var/lib/apt/lists/*
# Moodle 4.5.10, immutable official upstream commit (tag v4.5.10).
RUN curl -fsSL https://github.com/moodle/moodle/archive/b2c2f2a0c5f9a141896df6c322a0b6b29bb77646.tar.gz \
    | tar -xz --strip-components=1 -C /var/www/html \
    && mkdir -p /var/moodledata && chown www-data:www-data /var/moodledata
RUN printf 'max_input_vars=5000\nmemory_limit=256M\nupload_max_filesize=32M\npost_max_size=32M\n' > /usr/local/etc/php/conf.d/moodle.ini
COPY config.php /var/www/html/config.php
COPY scripts /opt/edumonitor
RUN chmod +x /opt/edumonitor/entrypoint.sh
ENTRYPOINT ["/opt/edumonitor/entrypoint.sh"]
CMD ["apache2-foreground"]
