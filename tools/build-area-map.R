# Run from the project root after extracting the supplied shapefile into data/geography-source.
library(sf)
library(jsonlite)
middle <- "mellanomraden" %in% commandArgs(trailingOnly = TRUE)
input <- if (middle) "data/geography-source/mellanomraden/Jur_mellanomraden_xu_region.shp" else "data/geography-source/Jur_stadsomraden_xu_region.shp"
x <- st_read(input, quiet = TRUE)
codes <- if (middle) x$MELLANOMRA else x$STADSOMRAD
stopifnot(st_crs(x)$epsg == 3007, all(st_is_valid(x)), nrow(x) == if (middle) 36 else 4, !anyDuplicated(codes))
# Keep the source geometry: shared boundaries, holes and offshore islands are retained.
# Coordinates are rendered directly in their local metric projection, north upwards.
bounds <- st_bbox(x)
scale <- 620 / max(bounds$xmax - bounds$xmin, bounds$ymax - bounds$ymin)
features <- lapply(seq_len(nrow(x)), function(i) {
  polygons <- st_geometry(st_cast(x[i, ], "MULTIPOLYGON"))[[1]]
  rings <- unlist(lapply(polygons, function(polygon) lapply(polygon, function(ring) {
    px <- 30 + (ring[, 1] - bounds$xmin) * scale
    py <- 30 + (bounds$ymax - ring[, 2]) * scale
    paste0("M", paste(sprintf("%.2f,%.2f", px, py), collapse = "L"), "Z")
  })), recursive = FALSE)
  list(code = sprintf("%02d", as.integer(codes[i])), name = x$NAMN[i], path = paste(rings, collapse = ""))
})
asset <- list(year = 2026, source = "Stadsområde_shp.zip, tillhandahållen av användaren som aktuell indelning 2026",
  sourceRegistrationDate = "2025-01-08", crs = "EPSG:3007", width = unname(60 + (bounds$xmax-bounds$xmin)*scale),
  height = unname(60 + (bounds$ymax-bounds$ymin)*scale), features = features)
if (middle) asset$source <- "Mellanområde_shp.zip, tillhandahållen av användaren september 2026"
write_json(asset, if (middle) "data/mellanomraden-map.json" else "data/stadsomraden-map.json", auto_unbox = TRUE, digits = 2)
