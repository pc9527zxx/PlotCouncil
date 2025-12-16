import matplotlib.pyplot as plt
import numpy as np
from scipy.spatial import Voronoi, voronoi_plot_2d
from matplotlib.patches import Ellipse
import matplotlib.patheffects as path_effects

def generate_synthetic_tissue_data(n_points=150, width=1.0, height=2.0):
    """
    Generates synthetic Voronoi data to simulate cellular tissue.
    Returns Voronoi object and points.
    """
    # Generate random points for cell centers
    # Use a slightly larger area to avoid edge effects, then clip later
    points = np.random.rand(n_points, 2)
    points[:, 0] = points[:, 0] * width * 1.2 - (width * 0.1)
    points[:, 1] = points[:, 1] * height * 1.1 - (height * 0.05)
    
    vor = Voronoi(points)
    return vor

def draw_glowing_lines(ax, vor, width, height):
    """
    Draws Voronoi ridges with a 'glow' effect to simulate fluorescence.
    """
    # Filter ridges to only those within the visible box
    # We simulate the look by plotting lines multiple times with different alpha/width
    
    # Separate regions for Green (main) and Blue (right edge)
    # We'll iterate through ridge vertices
    
    for simplex in vor.ridge_vertices:
        if -1 in simplex: continue # infinite ridge
        
        p1 = vor.vertices[simplex[0]]
        p2 = vor.vertices[simplex[1]]
        
        # Check if line is roughly within bounds
        if not ((-0.1 < p1[0] < width+0.1) and (-0.1 < p1[1] < height+0.1)):
            continue
            
        # Determine color based on x-position (Blue on the right edge)
        # Transition zone around x = 0.7 * width
        mid_x = (p1[0] + p2[0]) / 2
        if mid_x > 0.65 * width:
            base_color = '#0033FF' # Blueish
            glow_color = '#0000AA'
        else:
            base_color = '#00FF00' # Greenish
            glow_color = '#005500'
            
        # Draw "Glow" (thick, low alpha)
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], 
                color=glow_color, linewidth=4, alpha=0.3, solid_capstyle='round')
        # Draw "Core" (thin, high alpha)
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], 
                color=base_color, linewidth=1.5, alpha=0.8, solid_capstyle='round')

def add_scale_bar(ax, length, label, position=(0.95, 0.05), color='white'):
    """
    Adds a scale bar and label.
    position is (x, y) in axes fraction for the bottom-right corner of the bar.
    """
    # Draw line
    bar_x_end = position[0] * ax.get_xlim()[1]
    bar_x_start = bar_x_end - length
    bar_y = position[1] * ax.get_ylim()[1]
    
    ax.plot([bar_x_start, bar_x_end], [bar_y, bar_y], color=color, linewidth=3)
    
    # Add text
    ax.text((bar_x_start + bar_x_end)/2, bar_y + 0.05, label, 
            color=color, ha='center', va='bottom', fontsize=12, fontweight='bold')

def replicate_figure():
    # 1. Setup Figure
    # Aspect ratio roughly 1:2 per panel, so 2 panels side-by-side is 1:1 overall
    fig, axes = plt.subplots(1, 2, figsize=(8, 8), facecolor='white')
    plt.subplots_adjust(wspace=0.02, left=0.05, right=0.95, top=0.9, bottom=0.05)
    
    # Dimensions for synthetic data
    W, H = 10, 20
    vor = generate_synthetic_tissue_data(n_points=300, width=W, height=H)
    
    # 2. Plot Data on Both Panels
    for i, ax in enumerate(axes):
        # Set background
        ax.set_facecolor('black')
        ax.set_xlim(0, W)
        ax.set_ylim(0, H)
        
        # Remove axes ticks/spines
        ax.set_xticks([])
        ax.set_yticks([])
        for spine in ax.spines.values():
            spine.set_visible(False)
            
        # Draw the "cells"
        draw_glowing_lines(ax, vor, W, H)
        
        # Add Scale Bar (approx 20% of width for visual match)
        add_scale_bar(ax, length=W*0.2, label='20 µm', position=(0.9, 0.05))

    # 3. Specific Annotations for Panel 1 (Left)
    ax1 = axes[0]
    
    # "PNG" Text
    ax1.text(W/2, H/2, "PNG", color='white', fontsize=14, ha='center', va='center')
    
    # White Arrow (pointing to a junction)
    # xy is tip, xytext is tail
    ax1.annotate('', xy=(W*0.35, H*0.75), xytext=(W*0.25, H*0.8),
                 arrowprops=dict(facecolor='white', edgecolor='white', shrink=0.05, width=2, headwidth=8))
    
    # Red Double Arrow (spanning width)
    ax1.annotate('', xy=(W*0.85, H*0.75), xytext=(W*0.4, H*0.75),
                 arrowprops=dict(arrowstyle='<->', color='red', linewidth=2.5, mutation_scale=20))
    
    # Yellow Oval
    # Ellipse((center_x, center_y), width, height, angle)
    ellipse = Ellipse((W*0.35, H*0.3), width=W*0.4, height=H*0.1, 
                      edgecolor='yellow', facecolor='none', linewidth=2.5)
    ax1.add_patch(ellipse)
    
    # Title
    ax1.set_title("image 1", fontsize=12, color='black')

    # 4. Specific Annotations for Panel 2 (Right)
    ax2 = axes[1]
    
    # "JPEG" Text
    ax2.text(W/2, H/2, "JPEG", color='white', fontsize=14, ha='center', va='center')
    
    # Title
    ax2.set_title("image 2", fontsize=12, color='black')

    # 5. Global Label "A"
    # We place this relative to the figure or the first axis
    # Using figure coordinates for top-left placement
    fig.text(0.02, 0.92, 'A', fontsize=20, fontweight='bold', color='black')

    plt.show()

if __name__ == "__main__":
    replicate_figure()