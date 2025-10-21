#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$true)]
    [string]$PackagePath,

    [Parameter(Mandatory=$true)]
    [string]$SiteConfigPath,

    [Parameter(Mandatory=$false)]
    [string]$PlatformIdentifier,

    [Parameter(Mandatory=$false)]
    [string[]]$Binaries
)

# --- Hardcoded tool information ---
$ToolsOwner = 'getappmap'
$ToolsRepo = 'appmap-js'
$ToolsToDownload = @('appmap', 'scanner')
# --------------------------------

# Initialize Binaries as an empty array if not provided
if (-not $Binaries) {
    $Binaries = @()
}

# Split $Binaries into an array if it's a single string with spaces or commas
if ($Binaries.Count -eq 1) {
    $Binaries = $Binaries[0] -split '[\s,]+'
}

function Get-Releases() {
    $url = "https://api.github.com/repos/$ToolsOwner/$ToolsRepo/releases"
    try {
        Write-Host "Fetching releases from $url..."
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing
        $releases = $response.Content | ConvertFrom-Json
        return $releases
    } catch {
        Write-Error "Failed to get releases from GitHub API. Error: $_"
        return $null
    }
}

$script:cachedReleases = $null
function Get-Releases-Memoized() {
    if (-not $script:cachedReleases) {
        $script:cachedReleases = Get-Releases
    }
    return $script:cachedReleases
}

function Get-LatestRelease($package) {
    $releases = Get-Releases-Memoized
    # Find the latest release that matches the package
    foreach ($release in $releases) {
        if ($release.tag_name -like "*$package*") {
            Write-Host "Latest release for $package is $($release.tag_name)"
            return $release
        }
    }
    Write-Error "No matching release found for $package."
    return $null
}

function Download-File($url, $path) {
    if (Test-Path $path) {
        Write-Host "File $path already exists. Skipping download."
        return $true
    }
    try {
        Write-Host "Downloading from $url to $path..."
        Invoke-WebRequest -Uri $url -OutFile $path
        Write-Host "Download complete."
        return $true
    } catch {
        Write-Error "Failed to download file from $url. Error: $_"
        return $false
    }
}

if ($PlatformIdentifier) {
    Write-Host "Platform identifier provided: $PlatformIdentifier. Preparing to download tools."
    foreach ($tool in $ToolsToDownload) {
        $tool = $tool.Trim()
        $latestRelease = Get-LatestRelease -package "@appland/$tool"
        if ($latestRelease) {
            $os, $arch = $PlatformIdentifier.Split('-')
            $binaryExtension = if ($os -eq 'win') { ".exe" } else { "" }
            $url = $latestRelease.assets | Where-Object { $_.name -like "*$tool*$PlatformIdentifier*" } | Select-Object -First 1 | Select-Object -ExpandProperty browser_download_url
            if (-not $url) {
                Write-Error "No download URL found for $tool with platform identifier $PlatformIdentifier."
                continue
            }

            # tag name is like @appland/tool-vX.Y.Z, we want to extract the X.Y.Z part
            $version = $latestRelease.tag_name -replace '^.*-v', ''
            $fileName = "${tool}-${os}-${arch}-${version}${binaryExtension}"
            $downloadPath = Join-Path (Get-Location) $fileName
            
            if (Download-File -url $url -path $downloadPath) {
                $Binaries += $downloadPath
            }
        }
    }
}

try {
    # 1. Create a temporary directory for extraction
    if ($env:TEMP) {
        $baseTemp = $env:TEMP
    } elseif ($env:TMP) {
        $baseTemp = $env:TMP
    } else {
        $baseTemp = "/tmp"
    }
    $tempDir = Join-Path $baseTemp ([System.Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $tempDir | Out-Null

    Write-Host "Extracting package $PackagePath to a temporary directory..."
    # 2. Extract the package
    Expand-Archive -Path $PackagePath -DestinationPath $tempDir

    $topLevelDirs = Get-ChildItem -Path $tempDir -Directory
    if ($topLevelDirs.Count -ne 1) {
        throw "Error: Expected a single top-level directory in the package, but found $($topLevelDirs.Count)."
    }
    $topLevelDir = $topLevelDirs[0]
    
    $packageJsonPath = Join-Path $topLevelDir.FullName "package.json"
    if (Test-Path $packageJsonPath) {
        $packageJsonContent = Get-Content -Path $packageJsonPath -Raw
        $packageJson = $packageJsonContent | ConvertFrom-Json

        Write-Host "Reading site configuration from $SiteConfigPath..."
        $siteConfigContent = Get-Content -Path $SiteConfigPath -Raw
        if (-not $siteConfigContent) {
            throw "Error: site-config.json not found or empty"
        }
        $siteConfig = $siteConfigContent | ConvertFrom-Json -AsHashtable

        # 3. Backup original package.json and update it
        Write-Host "Updating package.json with site configuration..."
        Copy-Item -Path $packageJsonPath -Destination (Join-Path $topLevelDir.FullName "package.json.orig")

        if (-not $packageJson.contributes) {
            $packageJson | Add-Member -MemberType NoteProperty -Name "contributes" -Value ([pscustomobject]@{configuration = [pscustomobject]@{properties = [pscustomobject]@{}}})
        } elseif (-not $packageJson.contributes.configuration) {
            $packageJson.contributes | Add-Member -MemberType NoteProperty -Name "configuration" -Value ([pscustomobject]@{properties = [pscustomobject]@{}})
        }

        $configProperties = $packageJson.contributes.configuration.properties

        function Get-JsonSchemaType($val) {
            if ($null -eq $val) { return 'null' }
            $typeName = $val.GetType().Name
            switch ($typeName) {
                'String' { return 'string' }
                'Int32' { return 'integer' }
                'Int64' { return 'integer' }
                'Double' { return 'number' }
                'Single' { return 'number' }
                'Boolean' { return 'boolean' }
                'Hashtable' { return 'object' }
                'OrderedHashtable' { return 'object' }
                'Object[]' { return 'array' }
                'ArrayList' { return 'array' }
                default { return 'string' }
            }
        }

        foreach ($key in $siteConfig.Keys) {
            $value = $siteConfig[$key]
            Write-Host "Setting $key to $($value | ConvertTo-Json -Compress)"

            if ($configProperties.PSObject.Properties[$key]) {
                $configProperties.$key.default = $value
            } else {
                $newProperty = [pscustomobject]@{
                    type = Get-JsonSchemaType $value
                    default = $value
                    markdownDescription = ""
                }
                $configProperties | Add-Member -MemberType NoteProperty -Name $key -Value $newProperty
            }
        }
        
        # 5. Write the updated package.json
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path $packageJsonPath
    } else {
        Write-Host "package.json not found (expected for IntelliJ packages). Skipping configuration update."
    }

    # 4. Add site-config.json to the package folder
    Write-Host "Adding site-config.json to the package..."
    Copy-Item -Path $SiteConfigPath -Destination (Join-Path $topLevelDir.FullName "site-config.json")

    $resourcesDir = Join-Path $topLevelDir.FullName "resources"
    if (-not (Test-Path $resourcesDir)) {
        New-Item -ItemType Directory -Path $resourcesDir | Out-Null
    }

    # 4a. Add binaries to /<toplevel>/resources if provided
    if ($Binaries -and $Binaries.Count -gt 0) {
        Write-Host "Adding binaries to the package..."
        foreach ($bin in $Binaries) {
            $bin = $bin.Trim()
            if (Test-Path $bin) {
                $binFilename = Split-Path -leaf $bin
                Write-Host "- Adding $binFilename to /$($topLevelDir.Name)/resources"
                Copy-Item -Path $bin -Destination $resourcesDir -Force
                if ($IsLinux -or $IsMacOS) {
                    Write-Host "  - Setting executable permissions for $binFilename"
                    $destPath = Join-Path $resourcesDir $binFilename
                    chmod +x $destPath
                }
            } else {
                Write-Warning "Binary not found: $bin"
            }
        }
    }

    # 6. Repack the package
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($PackagePath)
    $extension = [System.IO.Path]::GetExtension($PackagePath)
    $outputPackagePath = "$baseName-mod$extension"
    if (Test-Path $outputPackagePath) {
        Remove-Item $outputPackagePath
    }
    Write-Host "Repacking the package to $outputPackagePath..."
    Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $outputPackagePath

    Write-Host "Successfully modified package. New file is at: $outputPackagePath"

} finally {
    # 7. Clean up the temporary directory
    if ($tempDir -and (Test-Path $tempDir)) {
        Write-Host "Cleaning up temporary files..."
        Remove-Item -Recurse -Force -Path $tempDir
    }
}
