import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import RegularPolygon
import matplotlib.ticker as ticker

def create_scientific_plot():
    # 1. Setup Data
    # Main plot data
    n_neighbors = np.arange(3, 11)  # 3 to 10
    
    # Synthetic data approximating the visual heights
    # Apical side (orange)
    apical_means = np.array([0.05, 0.24, 0.45, 0.19, 0.05, 0.01, 0.005, 0.002])
    apical_errs = np.array([0.01, 0.04, 0.06, 0.03, 0.01, 0.005, 0.002, 0.001])
    
    # Basal side (purple)
    basal_means = np.array([0.04, 0.22, 0.53, 0.14, 0.04, 0.02, 0.005, 0.001])
    basal_errs = np.array([0.01, 0.04, 0.05, 0.03, 0.01, 0.005, 0.002, 0.001])
    
    # Fit curve (Gaussian approximation)
    x_smooth = np.linspace(2.5, 10.5, 200)
    # A skewed gaussian-like curve
    mu = 5.6
    sigma = 1.2
    y_smooth = 0.48 * np.exp(-0.5 * ((x_smooth - mu) / sigma)**2)
    
    # Inset data: Interior angle formula
    n_inset = np.linspace(3, 10, 100)
    theta_n = 180 * (n_inset - 2) / n_inset

    # 2. Figure Setup
    fig, ax = plt.subplots(figsize=(6, 6), facecolor='white')
    
    # Colors
    color_apical = '#F0A840'  # Orange
    color_basal = '#9080C0'   # Muted Purple
    
    # 3. Main Plotting
    bar_width = 0.4
    
    # Bars
    ax.bar(n_neighbors - bar_width/2, apical_means, width=bar_width, 
           color=color_apical, label='apical side', 
           yerr=apical_errs, capsize=3, error_kw={'elinewidth': 1.5, 'ecolor': 'black'})
           
    ax.bar(n_neighbors + bar_width/2, basal_means, width=bar_width, 
           color=color_basal, label='basal side', 
           yerr=basal_errs, capsize=3, error_kw={'elinewidth': 1.5, 'ecolor': 'black'})
    
    # Curve
    ax.plot(x_smooth, y_smooth, color='black', linewidth=1.5, zorder=10)
    
    # 4. Axes Formatting
    ax.set_xlim(2.5, 10.5)
    ax.set_ylim(0.0, 0.6)
    
    ax.set_ylabel('fraction of cells (%)', fontsize=14, labelpad=10)
    ax.set_xlabel('number of neighbors $n$', fontsize=14, labelpad=35) # Extra padding for custom ticks
    
    # Ticks style
    ax.tick_params(axis='y', direction='in', length=4, labelsize=12)
    ax.tick_params(axis='x', direction='in', length=0) # Hide standard x ticks
    
    # Remove top and right spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    # Custom X-Axis Labels (Geometric Shapes)
    # Hide default labels
    ax.set_xticklabels([])
    
    # Draw shapes and numbers
    # We use axis transform to place them below the axis
    trans = ax.get_xaxis_transform()
    
    for i in n_neighbors:
        # Determine shape (num vertices)
        # 3=triangle, 4=square, etc.
        # Matplotlib RegularPolygon uses radius.
        
        # Position: x=i, y=-0.08 (in axes coordinates relative to x-axis)
        # We use scatter for easier marker handling
        
        # Marker mapping
        # 3: triangle_up (^), 4: square (s), 5: pentagon (p), 6: hexagon (h), 8: octagon (8)
        # For 7, 9, 10 we need custom regular polygons
        
        # Using a consistent approach: RegularPolygon patch for all
        # Radius in data coordinates is tricky because aspect ratio. 
        # Let's use scatter with large markers.
        
        marker_style = (i, 0, 0) # (numsides, style, angle)
        
        # Draw the white filled shape with black outline
        ax.scatter([i], [-0.08], transform=trans, marker=marker_style, 
                   s=400, facecolor='white', edgecolor='black', linewidth=1.2, clip_on=False, zorder=20)
        
        # Draw the number inside
        ax.text(i, -0.08, str(i), transform=trans, ha='center', va='center', 
                fontsize=11, fontweight='normal', color='black', clip_on=False, zorder=21)

    # 5. Legend
    # Custom legend handles to match square markers in image
    from matplotlib.lines import Line2D
    legend_elements = [
        Line2D([0], [0], marker='s', color='w', label='apical side',
               markerfacecolor=color_apical, markersize=10),
        Line2D([0], [0], marker='s', color='w', label='basal side',
               markerfacecolor=color_basal, markersize=10)
    ]
    ax.legend(handles=legend_elements, loc='upper left', frameon=False, fontsize=10, handletextpad=0.5)
    
    # 6. Inset Plot
    # Position: [left, bottom, width, height] in axes coordinates
    ax_ins = ax.inset_axes([0.55, 0.45, 0.4, 0.35])
    
    ax_ins.plot(n_inset, theta_n, color='black', linewidth=1.2)
    
    # Inset formatting
    ax_ins.set_xlim(3, 10)
    ax_ins.set_ylim(60, 180)
    ax_ins.set_xticks([3, 4, 5, 6, 7, 8, 9, 10])
    ax_ins.set_yticks([60, 80, 100, 120, 140, 160, 180])
    
    # Simplify inset ticks
    ax_ins.tick_params(axis='both', which='major', labelsize=8, direction='in', length=2)
    # Only show some ticks to match image clean look if needed, but image shows 3..10 ticks
    # The image shows ticks 3,4,5,6,7,8,9,10 but labels only 3,4,5... actually labels are small.
    # Let's keep all ticks but maybe reduce label density if it gets crowded? 
    # Image shows labels for 3, 4, 5, 6, 7, 8, 9, 10.
    
    ax_ins.set_xlabel('$n$', fontsize=9, labelpad=1)
    ax_ins.set_ylabel(r'Interior angle $\theta_n$ ($^\circ$)', fontsize=9, labelpad=1)
    
    # Inset spines
    ax_ins.spines['top'].set_visible(False)
    ax_ins.spines['right'].set_visible(False)
    
    # Inset Annotation
    ax_ins.text(5, 150, r'$180^\circ (n-2)/n$', fontsize=9, color='black')

    plt.tight_layout()
    return fig

# Execute
if __name__ == "__main__":
    fig = create_scientific_plot()
    plt.show()