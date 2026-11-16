# ==========================================
# VPC
# ==========================================

resource "aws_vpc" "work_manager" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "work-manager-vpc"
  }
}

# ==========================================
# Subnets
# ==========================================

resource "aws_subnet" "public_1a" {
  vpc_id                  = aws_vpc.work_manager.id
  cidr_block              = "10.0.0.0/20"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = false

  tags = {
    Name = "work-manager-vpc-subnet-public1-ap-northeast-1a"
  }
}

resource "aws_subnet" "public_1c" {
  vpc_id                  = aws_vpc.work_manager.id
  cidr_block              = "10.0.16.0/20"
  availability_zone       = "ap-northeast-1c"
  map_public_ip_on_launch = false

  tags = {
    Name = "work-manager-vpc-subnet-public2-ap-northeast-1c"
  }
}

resource "aws_subnet" "private_1a" {
  vpc_id                  = aws_vpc.work_manager.id
  cidr_block              = "10.0.128.0/20"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = false

  tags = {
    Name = "work-manager-vpc-subnet-private1-ap-northeast-1a"
  }
}

resource "aws_subnet" "private_1c" {
  vpc_id                  = aws_vpc.work_manager.id
  cidr_block              = "10.0.144.0/20"
  availability_zone       = "ap-northeast-1c"
  map_public_ip_on_launch = false

  tags = {
    Name = "work-manager-vpc-subnet-private2-ap-northeast-1c"
  }
}

# ==========================================
# Internet Gateway
# ==========================================

resource "aws_internet_gateway" "work_manager" {
  vpc_id = aws_vpc.work_manager.id

  tags = {
    Name = "work-manager-vpc-igw"
  }
}

# ==========================================
# Route Tables
# ==========================================

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.work_manager.id

  tags = {
    Name = "work-manager-vpc-rtb-public"
  }
}

resource "aws_route_table" "private_1a" {
  vpc_id = aws_vpc.work_manager.id

  tags = {
    Name = "work-manager-vpc-rtb-private1-ap-northeast-1a"
  }
}

resource "aws_route_table" "private_1c" {
  vpc_id = aws_vpc.work_manager.id

  tags = {
    Name = "work-manager-vpc-rtb-private2-ap-northeast-1c"
  }
}

# ==========================================
# Routes
# ==========================================

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.work_manager.id
}

# ==========================================
# Route Table Associations
# ==========================================

resource "aws_route_table_association" "public_1a" {
  subnet_id      = aws_subnet.public_1a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_1c" {
  subnet_id      = aws_subnet.public_1c.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_1a" {
  subnet_id      = aws_subnet.private_1a.id
  route_table_id = aws_route_table.private_1a.id
}

resource "aws_route_table_association" "private_1c" {
  subnet_id      = aws_subnet.private_1c.id
  route_table_id = aws_route_table.private_1c.id
}
