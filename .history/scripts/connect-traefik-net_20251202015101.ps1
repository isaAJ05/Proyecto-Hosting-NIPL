param(
    [string]$NetworkName = 'traefik-net',
    [string]$ContainerName = 'proyecto_traefik',
    [int]$Retries = 8,
    [int]$DelaySeconds = 3
)

function Ensure-NetworkExists {
    param($name)
    $exists = docker network ls --format '{{.Name}}' | Where-Object { $_ -eq $name }
    if (-not $exists) {
        Write-Host "Network '$name' not found. Creating..."
        docker network create $name | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to create network $name" }
        Write-Host "Network '$name' created."
    }
    else { Write-Host "Network '$name' already exists." }
}

function Is-ContainerOnNetwork {
    param($container, $network)
    $json = docker inspect $container --format '{{json .NetworkSettings.Networks}}' 2>$null
    if (-not $json) { return $false }
    return $json -like "*`"$network`"*"
}

Ensure-NetworkExists -name $NetworkName

$attempt = 0
while ($attempt -lt $Retries) {
    $attempt++
    Write-Host "Attempt $attempt/$Retries: connecting container '$ContainerName' to network '$NetworkName'..."
    try {
        if (Is-ContainerOnNetwork -container $ContainerName -network $NetworkName) {
            Write-Host "Container '$ContainerName' is already connected to '$NetworkName'."
            exit 0
        }
        docker network connect $NetworkName $ContainerName 2>$null
        Start-Sleep -Seconds 1
        if (Is-ContainerOnNetwork -container $ContainerName -network $NetworkName) {
            Write-Host "Connected successfully."
            exit 0
        }
        else {
            Write-Warning "Connect command ran but container is not on network yet."
        }
    }
    catch {
        Write-Warning "Attempt failed: $($_.Exception.Message)"
    }
    Write-Host "Waiting $DelaySeconds seconds before retrying..."
    Start-Sleep -Seconds $DelaySeconds
}

Write-Error "Failed to connect container '$ContainerName' to network '$NetworkName' after $Retries attempts."
Write-Host "You can try to restart the container or inspect its status with:`n  docker ps -a | Select-String $ContainerName`n  docker inspect $ContainerName`nThen re-run this script."
exit 1
